import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "../types.js";
import { prisma } from "../../db/prisma.js";

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
      socket.emit("conversation:error", { message: "Failed to start conversation." });
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
    } catch (err) {
      console.error("Join conversation error:", err);
    }
  });

  socket.on("conversation:leave", async (conversationId: string) => {
    socket.leave(conversationId);
    console.log(`📤 ${userId} left conversation ${conversationId}`);
  });
};
