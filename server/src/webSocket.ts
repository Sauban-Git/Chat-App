import { Server as HTTPServer } from "http";
import { Socket, Server as SocketIOServer } from "socket.io";
import { prisma } from "./db/prisma.js";
import jwt from "jsonwebtoken";
import {
  subscribeToTyping,
  subscribeToPresence,
  publishTypingStatus,
  publishPresence,
} from "./db/redis.js";
import { COOKIE_NAME, JWT_SECRET } from "./config/jwt.js";
import { presenceEmitter } from "./utils/utils.js";

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
  };
}

const conversationTypingSockets = new Map<string, Set<AuthenticatedSocket>>();
const redisTypingSubscribedConversations = new Set<string>();
const redisTypingUnsubscribers = new Map<string, () => Promise<void>>();

export const setUpSocket = (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie;
      if (!cookies) return next(new Error("No cookies sent"));

      const parsedCookies = Object.fromEntries(
        cookies.split("; ").map((c) => {
          const [key, v] = c.split("=");
          return [key, decodeURIComponent(v!)];
        })
      );

      const token = parsedCookies[COOKIE_NAME];
      if (!token) return next(new Error("No auth token found"));

      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      if (!payload.userId) return next(new Error("Invalid token payload"));

      (socket as AuthenticatedSocket).data.userId = payload.userId;
      next();
    } catch (err: any) {
      console.error("Socket auth error:", err.message);
      next(new Error("Authentication error: " + err.message));
    }
  });

  io.on("connection", async (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    if (!userId) return socket.disconnect();

    console.log(`✅ User connected: ${userId}`);
    publishPresence(userId, "online");

    // ✅ Mark all undelivered messages to this user as delivered
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
        select: { id: true },
      });

      const conversationIds = conversations.map((c) => c.id);

      if (conversationIds.length > 0) {
        const deliveredAt = new Date();

        // Get message IDs before updating
        const undeliveredMessages = await prisma.message.findMany({
          where: {
            conversationId: { in: conversationIds },
            senderId: { not: userId },
            deliveredAt: null,
          },
          select: { id: true, conversationId: true },
        });

        const messageIds = undeliveredMessages.map((m) => m.id);

        if (messageIds.length > 0) {
          await prisma.message.updateMany({
            where: { id: { in: messageIds } },
            data: { deliveredAt },
          });

          for (const message of undeliveredMessages) {
            io.to(message.conversationId).emit("message:delivered", {
              messageId: message.id,
              userId,
              deliveredAt: deliveredAt.toISOString(),
            });
          }

          console.log(
            `📦 Delivered ${messageIds.length} messages for user ${userId}`
          );
        }
      }
    } catch (err) {
      console.error("❌ Error marking messages as delivered:", err);
    }

    // Presence listener
    const presenceListener = (data: {
      userId: string;
      status: "online" | "offline";
    }) => {
      socket.emit("presence:update", data);
    };
    presenceEmitter.on("presence:update", presenceListener);

    async function leaveConversationTyping(conversationId: string) {
      const socketsSet = conversationTypingSockets.get(conversationId);
      if (!socketsSet) return;

      socketsSet.delete(socket);
      if (socketsSet.size === 0) {
        conversationTypingSockets.delete(conversationId);
        redisTypingSubscribedConversations.delete(conversationId);

        const unsubscribe = redisTypingUnsubscribers.get(conversationId);
        if (unsubscribe) {
          try {
            await unsubscribe();
          } catch (err) {
            console.error(
              `Error unsubscribing from Redis typing for conversation ${conversationId}`,
              err
            );
          }
          redisTypingUnsubscribers.delete(conversationId);
        }
      }
    }

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

        // Track typing subscriptions
        let socketsSet = conversationTypingSockets.get(conversationId);
        if (!socketsSet) {
          socketsSet = new Set();
          conversationTypingSockets.set(conversationId, socketsSet);
        }
        socketsSet.add(socket);

        // Subscribe to Redis typing (same as before)
        if (!redisTypingSubscribedConversations.has(conversationId)) {
          const unsubscribe = await subscribeToTyping(
            conversationId,
            (data) => {
              const sockets = conversationTypingSockets.get(conversationId);
              if (!sockets) return;

              for (const s of sockets) {
                if (s.data.userId !== data.userId) {
                  s.to(conversationId).emit("typing:update", data);
                }
              }
            }
          );

          redisTypingSubscribedConversations.add(conversationId);
          redisTypingUnsubscribers.set(conversationId, unsubscribe);
        }

        // ✅ Mark unread messages as read
        try {
          const unreadMessages = await prisma.message.findMany({
            where: {
              conversationId,
              senderId: { not: userId },
              readAt: null,
            },
            select: { id: true },
          });

          const readAt = new Date();

          if (unreadMessages.length > 0) {
            const messageIds = unreadMessages.map((m) => m.id);

            await prisma.message.updateMany({
              where: { id: { in: messageIds } },
              data: { readAt },
            });

            // Emit read event per message
            for (const { id } of unreadMessages) {
              io.to(conversationId).emit("message:read", {
                messageId: id,
                userId,
                readAt: readAt.toISOString(),
              });
            }

            console.log(
              `👁️ Marked ${unreadMessages.length} messages as read in conversation ${conversationId}`
            );
          }
        } catch (err) {
          console.error("Failed to mark messages as read:", err);
        }
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

      await leaveConversationTyping(conversationId);
      publishTypingStatus(conversationId, userId, false);
    });

    socket.on(
      "typing:start",
      ({ conversationId }: { conversationId: string }) => {
        publishTypingStatus(conversationId, userId, true);
      }
    );

    socket.on(
      "typing:stop",
      ({ conversationId }: { conversationId: string }) => {
        publishTypingStatus(conversationId, userId, false);
      }
    );

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
            sender: { select: { id: true, name: true, email: true } },
          },
        });

        io.to(conversationId).emit("message:new", message);
      } catch (err) {
        console.error("Message error:", err);
        socket.emit("message:error", { message: "Failed to send message." });
      }
    });

    socket.on("disconnect", async () => {
      console.log(`❌ User disconnected: ${userId}`);

      presenceEmitter.off("presence:update", presenceListener);

      for (const [conversationId, socketsSet] of conversationTypingSockets) {
        if (socketsSet.has(socket)) {
          socketsSet.delete(socket);
          publishTypingStatus(conversationId, userId, false);

          if (socketsSet.size === 0) {
            conversationTypingSockets.delete(conversationId);
            redisTypingSubscribedConversations.delete(conversationId);

            const unsubscribe = redisTypingUnsubscribers.get(conversationId);
            if (unsubscribe) {
              try {
                await unsubscribe();
              } catch (err) {
                console.error(
                  `Error unsubscribing from Redis typing for conversation ${conversationId}`,
                  err
                );
              }
              redisTypingUnsubscribers.delete(conversationId);
            }
          }
        }
      }

      publishPresence(userId, "offline");
    });
  });

  console.log("⚡ Socket.IO server initialized");
};
