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

// Custom socket type with typed `data` field
interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
  };
}

// Global map: conversationId -> Set of sockets subscribed to that conversation's typing events
const conversationTypingSockets = new Map<
  string,
  Set<AuthenticatedSocket>
>();

// Track which conversations we have subscribed to Redis typing channel for
const redisTypingSubscribedConversations = new Set<string>();

// Track unsubscribe functions for Redis typing subscriptions per conversation
const redisTypingUnsubscribers = new Map<string, () => Promise<void>>();

export const setUpSocket = (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Middleware for authentication (same as before) ...
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

  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;
    if (!userId) return socket.disconnect();

    console.log(`✅ User connected: ${userId}`);
    publishPresence(userId, "online");

    // Presence listener for the connected socket
    const presenceListener = (data: {
      userId: string;
      status: "online" | "offline";
    }) => {
      socket.emit("presence:update", data);
    };
    presenceEmitter.on("presence:update", presenceListener);

    // Helper to clean up socket from conversationTypingSockets map
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
            console.error(`Error unsubscribing from Redis typing for conversation ${conversationId}`, err);
          }
          redisTypingUnsubscribers.delete(conversationId);
        }
      }
    }

    // Handle joining a conversation room
    socket.on("conversation:join", async (conversationId: string) => {
      try {
        // Validate user is in the conversation
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

        // Add socket to local map
        let socketsSet = conversationTypingSockets.get(conversationId);
        if (!socketsSet) {
          socketsSet = new Set();
          conversationTypingSockets.set(conversationId, socketsSet);
        }
        socketsSet.add(socket);

        // Subscribe to Redis typing channel once per conversation
        if (!redisTypingSubscribedConversations.has(conversationId)) {
          const unsubscribe = await subscribeToTyping(conversationId, (data) => {
            // Emit typing:update to all sockets except the typing user
            const sockets = conversationTypingSockets.get(conversationId);
            if (!sockets) return;

            for (const s of sockets) {
              if (s.data.userId !== data.userId) {
                s.to(conversationId).emit("typing:update", data);
              }
            }
          });

          redisTypingSubscribedConversations.add(conversationId);
          redisTypingUnsubscribers.set(conversationId, unsubscribe);
        }
      } catch (err) {
        console.error("Join conversation error:", err);
        socket.emit("conversation:error", {
          message: "Failed to join conversation.",
        });
      }
    });

    // Handle leaving a conversation
    socket.on("conversation:leave", async (conversationId: string) => {
      socket.leave(conversationId);
      console.log(`📤 ${userId} left conversation ${conversationId}`);

      await leaveConversationTyping(conversationId);
      publishTypingStatus(conversationId, userId, false); // Notify others
    });

    // Typing events
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

    // Sending a message (same as before)
    socket.on(
      "message:send",
      async ({
        conversationId,
        text,
      }: {
        conversationId: string;
        text: string;
      }) => {
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
      }
    );

    // Handle disconnect
    socket.on("disconnect", async () => {
      console.log(`❌ User disconnected: ${userId}`);

      presenceEmitter.off("presence:update", presenceListener);

      // Remove socket from all conversation typing subscriptions
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
                console.error(`Error unsubscribing from Redis typing for conversation ${conversationId}`, err);
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
