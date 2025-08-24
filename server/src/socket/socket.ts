// socket.ts
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
  | "status:offline";

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
};

let isSubscribed = false;

function setupRedisSubscriptions(io: Server) {
  if (isSubscribed) return;

  Object.values(eventChannels).forEach((channel) => {
    RedisPubSub.subscribe(channel, (data: PubSubPayload) => {
      const { event, conversationId, payload } = data;

      // For online/offline, broadcast globally
      if (event === "status:online" || event === "status:offline") {
        io.emit(event, payload); // ✅ Broadcast to all clients
      }

      // For messages and typing, emit to the conversation room
      else if (conversationId) {
        io.to(conversationId).emit(event, payload);
      }

      // Fallback
      else {
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
      const token = parsedCookies.token; // Make sure your cookie is actually named 'token'

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

    // Join user's personal room
    socket.join(userId);

    // Auto-join all conversations the user is in
    const userConversations = await getUserConversations(userId);
    userConversations.forEach((conversationId) => {
      socket.join(conversationId);
      console.log(`📥 ${userId} joined conversation: ${conversationId}`);
    });

    // Optional manual join
    socket.on("join", ({ conversationId }) => {
      if (conversationId) {
        socket.join(conversationId);
        console.log(`➡️ ${userId} manually joined: ${conversationId}`);
      }

      // Re-join user room if needed
      socket.join(userId);
    });

    // Message events
    socket.on("message:new", (data) => {
      RedisPubSub.publish(eventChannels.message, {
        event: "message:new",
        conversationId: data.conversationId,
        payload: {
          ...data,
          senderId: userId, // Always trust server
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

    // Typing indicators
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

    // Status indicators (do not trust client userId)
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

    // On disconnect, publish offline status
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
