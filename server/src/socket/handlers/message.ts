import { Server as SocketIOServer } from "socket.io";
import { prisma } from "../../db/prisma.js";
import type { AuthenticatedSocket } from "../types.js";
import {
  publishToChannel,
  subscribeToChannel,
  unsubscribeFromChannel,
} from "../../db/redis.js";

export const registerMessageHandlers = (
  socket: AuthenticatedSocket,
  io: SocketIOServer
) => {
  const userId = socket.data.userId;
  const subscribedConversations = new Set<string>();

  socket.on("message:send", async ({ conversationId, text }) => {
    try {
      // Check participation
      const isParticipant = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      });

      if (!isParticipant) {
        return socket.emit("message:error", {
          message: "You are not part of this conversation.",
        });
      }

      // Create new message with sender info included
      const message = await prisma.message.create({
        data: {
          text,
          senderId: userId,
          conversationId,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Publish only the new message (not all)
      const redisChannel = `conversation:${conversationId}:messages`;
      await publishToChannel(redisChannel, JSON.stringify(message));
    } catch (err) {
      console.error("Send message error:", err);
      socket.emit("message:error", { message: "Failed to send message." });
    }
  });

  socket.on("message:join", async (conversationId: string) => {
    try {
      if (subscribedConversations.has(conversationId)) return;

      const isParticipant = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      });

      if (!isParticipant) {
        return socket.emit("message:error", {
          message: "You cannot join this conversation.",
        });
      }

      socket.join(conversationId);

      const redisChannel = `conversation:${conversationId}:messages`;

      await subscribeToChannel(redisChannel, (_channel, rawMessage) => {
        const message = JSON.parse(rawMessage); // single message
        io.to(conversationId).emit("message:new", message);
      });

      subscribedConversations.add(conversationId);
      console.log(`✅ Subscribed ${userId} to ${redisChannel}`);
    } catch (err) {
      console.error("Join message channel error:", err);
      socket.emit("message:error", {
        message: "Failed to join message channel.",
      });
    }
  });

  socket.on("message:leave", async (conversationId: string) => {
    socket.leave(conversationId);

    if (subscribedConversations.has(conversationId)) {
      subscribedConversations.delete(conversationId);

      const redisChannel = `conversation:${conversationId}:messages`;

      await unsubscribeFromChannel(redisChannel);

      console.log(`👋 ${userId} left conversation ${conversationId}`);
    }
  });
};
