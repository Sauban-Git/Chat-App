import { Server, Socket } from "socket.io";
import { RedisPubSub } from "../db/redis.js";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/jwt.js";
import { prisma } from "../db/prisma.js";
import cookie from "cookie";

type ChatEvents =
  | "message:new"
  | "conversation:new"
  | "typing:start"
  | "typing:stop"
  | "status:online"
  | "status:offline"
  | "message:delivered"
  | "message:read";

interface PubSubPayload {
  event: ChatEvents;
  conversationId?: string;
  userId?: string;
  payload: any;
}

const eventChannels = {
  message: "channel:message:new",
  conversation: "channel:conversation:new",
  typingStart: "channel:typing:start",
  typingStop: "channel:typing:stop",
  statusOnline: "channel:status:online",
  statusOffline: "channel:status:offline",
  messageDelivered: "channel:message:delivered",
  messageRead: "channel:message:read",
};

let isSubscribed = false;

function setupRedisSubscriptions(io: Server) {
  if (isSubscribed) return;

  Object.values(eventChannels).forEach((channel) => {
    RedisPubSub.subscribe(channel, (data: PubSubPayload) => {
      const { event, conversationId, payload } = data;

      if (event === "status:online" || event === "status:offline") {
        io.emit(event, payload); // broadcast globally
      } else if (event === "message:delivered" || event === "message:read") {
        // Broadcast message status update to conversation room
        if (conversationId) {
          io.to(conversationId).emit(event, payload);
        }
      } else if (conversationId) {
        io.to(conversationId).emit(event, payload);
      } else {
        io.emit(event, payload);
      }
    });
  });

  isSubscribed = true;
}

async function getUserConversations(userId: string): Promise<string[]> {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    select: { id: true },
  });

  return conversations.map((c) => c.id);
}

export const setupSocket = (io: Server) => {
  setupRedisSubscriptions(io);

  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) {
        return next(new Error("No cookies found"));
      }

      const parsedCookies = cookie.parse(cookieHeader);
      const token = parsedCookies.token;

      if (!token) {
        return next(new Error("Token not found in cookies"));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      if (typeof decoded !== "object" || !decoded.userId) {
        return next(new Error("Invalid token"));
      }

      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      console.error("Socket auth error:", err);
      return next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`🔌 Socket connected: ${socket.id} | User: ${userId}`);

    if (!userId) return;

    // Join user personal room
    socket.join(userId);

    // Auto join all conversations user is part of
    const userConversations = await getUserConversations(userId);
    userConversations.forEach((conversationId) => {
      socket.join(conversationId);
      console.log(`📥 ${userId} joined conversation: ${conversationId}`);
    });

    // Mark all undelivered messages *to* this user as delivered
    try {
      const updated = await prisma.message.updateMany({
        where: {
          conversationId: { in: userConversations },
          senderId: { not: userId }, // messages NOT sent by user
          deliveredAt: null,
        },
        data: {
          deliveredAt: new Date(),
        },
      });

      if (updated.count > 0) {
        // Broadcast delivered event per conversation, optionally batch by conversation
        // For simplicity, emit a general event
        userConversations.forEach((conversationId) => {
          RedisPubSub.publish(eventChannels.messageDelivered, {
            event: "message:delivered",
            conversationId,
            payload: { userId, conversationId }, // Add more info if needed
          });
        });
      }
    } catch (error) {
      console.error("Error updating delivered messages:", error);
    }

    // Listen for manual join to conversation room (e.g. when user opens a conversation)
    socket.on("join", async ({ conversationId }) => {
      if (conversationId) {
        socket.join(conversationId);
        console.log(`➡️ ${userId} manually joined: ${conversationId}`);

        // Mark all unread messages in that conversation as read
        try {
          const updatedRead = await prisma.message.updateMany({
            where: {
              conversationId,
              senderId: { not: userId },
              readAt: null,
            },
            data: {
              readAt: new Date(),
            },
          });

          if (updatedRead.count > 0) {
            RedisPubSub.publish(eventChannels.messageRead, {
              event: "message:read",
              conversationId,
              payload: { userId, conversationId }, // Add more info if needed
            });
          }
        } catch (error) {
          console.error("Error updating read messages:", error);
        }
      }

      // Ensure user room is joined
      socket.join(userId);
    });

    // Message events
    socket.on("message:new", (data) => {
      RedisPubSub.publish(eventChannels.message, {
        event: "message:new",
        conversationId: data.conversationId,
        payload: {
          ...data,
          senderId: userId,
        },
      });
    });

    socket.on("conversation:new", (data) => {
      RedisPubSub.publish(eventChannels.conversation, {
        event: "conversation:new",
        conversationId: data.conversationId,
        payload: data,
      });
    });

    // Typing events
    socket.on("typing:start", (data) => {
      RedisPubSub.publish(eventChannels.typingStart, {
        event: "typing:start",
        conversationId: data.conversationId,
        payload: { ...data, userId },
      });
    });

    socket.on("typing:stop", (data) => {
      RedisPubSub.publish(eventChannels.typingStop, {
        event: "typing:stop",
        conversationId: data.conversationId,
        payload: { ...data, userId },
      });
    });

    // Status online/offline events from client (do not trust userId from client)
    socket.on("status:online", () => {
      RedisPubSub.publish(eventChannels.statusOnline, {
        event: "status:online",
        userId,
        payload: { userId },
      });
    });

    socket.on("status:offline", () => {
      RedisPubSub.publish(eventChannels.statusOffline, {
        event: "status:offline",
        userId,
        payload: { userId },
      });
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Disconnected: ${socket.id} | User: ${userId}`);

      RedisPubSub.publish(eventChannels.statusOffline, {
        event: "status:offline",
        userId,
        payload: { userId },
      });
    });
  });
};
