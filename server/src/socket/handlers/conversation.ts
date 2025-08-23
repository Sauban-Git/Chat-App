import { Server as SocketIOServer } from "socket.io";
import type { AuthenticatedSocket } from "../types.js";
import { prisma } from "../../db/prisma.js";
import {
  publisher,
  subscriber,
  subscribeToChannel,
  unsubscribeFromChannel,
} from "../../db/redis.js";

export const registerConversationHandlers = (
  socket: AuthenticatedSocket,
  io: SocketIOServer
) => {
  const userId = socket.data.userId;

  socket.on("conversation:initiate", async ({ recipientId }, callback) => {
    try {
      let conversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { user1Id: userId, user2Id: recipientId },
            { user1Id: recipientId, user2Id: userId },
          ],
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            user1Id: userId,
            user2Id: recipientId,
          },
        });
      }

      callback({ conversationId: conversation.id });
    } catch (err) {
      console.error("Error initiating conversation:", err);
      socket.emit("conversation:error", {
        message: "Failed to start conversation.",
      });
    }
  });

  socket.on("conversation:join", async (conversationId: string) => {
    try {
      const isParticipant = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      });

      if (!isParticipant) {
        return socket.emit("conversation:error", {
          message: "Access denied to this conversation.",
        });
      }

      socket.join(conversationId);
      console.log(`📥 ${userId} joined conversation ${conversationId}`);

      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: {
            not: userId,
          },
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      const messages = await prisma.message.findMany({
        where: {
          conversationId,
          conversation: {
            OR: [{ user1Id: userId }, { user2Id: userId }],
          },
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
        orderBy: {
          createdAt: "asc",
        },
      });

      socket.emit("conversation:messages", { messages });

      const redisChannel = `conversation:${conversationId}`;

      // Subscribe with ref counting
      await subscribeToChannel(redisChannel, (message) => {
        const parsed = JSON.parse(message);
        io.to(conversationId).emit("conversation:message", parsed);
      });
    } catch (err) {
      console.error("Join conversation error:", err);
      socket.emit("conversation:error", {
        message: "Failed to join conversation.",
      });
    }
  });

  socket.on("conversation:leave", async (conversationId: string) => {
    socket.leave(conversationId);
    console.log(`📤 ${userId} left conversation ${conversationId}`);

    const redisChannel = `conversation:${conversationId}`;
    await unsubscribeFromChannel(redisChannel);
  });

  socket.on("conversation:message", async ({ conversationId, message }) => {
    try {
      const isParticipant = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      });

      if (!isParticipant) {
        return socket.emit("conversation:error", {
          message: "Unauthorized to send message.",
        });
      }

      const payload = {
        userId,
        message,
        conversationId,
        timestamp: new Date().toISOString(),
      };

      const redisChannel = `conversation:${conversationId}`;
      await publisher.publish(redisChannel, JSON.stringify(payload));
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });
};
