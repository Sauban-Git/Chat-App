import { Server as SocketIOServer } from "socket.io";
import { prisma } from "../../db/prisma.js";
import type { AuthenticatedSocket } from "../types.js";

export const registerMessageHandlers = (
  socket: AuthenticatedSocket,
  io: SocketIOServer
) => {
  const userId = socket.data.userId;

  socket.on("message:send", async ({ conversationId, text }) => {
    try {
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

      io.to(conversationId).emit("message:new", message);
    } catch (err) {
      console.error("Send message error:", err);
      socket.emit("message:error", { message: "Failed to send message." });
    }
  });
};
