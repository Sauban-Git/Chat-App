import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import {
  addConversationSubscriber,
  addUserOnlineClient,
  addUserSubscriber,
  getConversationSubscribers,
  getUserOnlineClientCount,
  removeConversationSubscriber,
  removeUserOnlineClient,
  removeUserSubscriber,
  getAllOnlineUsers,
} from "../db/redis.js";
import { prisma } from "../db/prisma.js";
import { JWT_SECRET } from "../config/jwt.js";

type ExtendedSocket = Socket & { userId?: string; clientId?: string };

const clientSubscriptions = new Map<string, Set<string>>(); // clientId -> conversationIds

export async function setupSocket(server: HttpServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 10000,
    pingInterval: 5000,
  });

  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) return next(new Error("No cookies found"));

      const parsedCookies = cookie.parse(cookieHeader);
      const token = parsedCookies.token;
      if (!token) return next(new Error("Token not found in cookies"));

      const decoded = jwt.verify(token, JWT_SECRET);
      if (typeof decoded !== "object" || !decoded.userId) {
        return next(new Error("Invalid token"));
      }

      socket.data.userId = decoded.userId;
      next();
    } catch {
      return next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket: ExtendedSocket) => {
    const userId = socket.data.userId!;
    const clientId = socket.id;
    socket.data.clientId = clientId;

    // Disconnect other sockets for same user (enforce one connection)
    for (const [id, s] of io.sockets.sockets) {
      if (s.data.userId === userId && id !== clientId) {
        s.disconnect(true);
      }
    }

    // -----------------------------
    // Step 1: Presence - mark online
    // -----------------------------
    await addUserOnlineClient(userId, clientId);

    // Step 2: Send full online list to THIS socket ONLY
    const onlineUsers = await getAllOnlineUsers();
    // This ensures the new user sees all currently online users immediately
    socket.emit("status:online:all", { users: onlineUsers });

    // Step 3: Broadcast to others that THIS user is online
    socket.broadcast.emit("status:online", { userId });
    console.log(`✅ status:online — user ${userId}`);

    // -----------------------------
    // Step 4: Auto-subscribe to conversations
    // -----------------------------
    const userConversations = await prisma.conversation.findMany({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
      select: { id: true },
    });

    const subs = new Set<string>();
    for (const conv of userConversations) {
      await addConversationSubscriber(conv.id, clientId);
      subs.add(conv.id);
    }
    clientSubscriptions.set(clientId, subs);
    await addUserSubscriber(userId, clientId);

    // -----------------------------
    // Typing
    // -----------------------------
    socket.on("typing:start", ({ conversationId }) => {
      getConversationSubscribers(conversationId).then((clientIds) => {
        clientIds.forEach((cid) => {
          const s = io.sockets.sockets.get(cid);
          if (s && s.data.clientId !== clientId) {
            s.emit("typing:start", { conversationId, userId });
          }
        });
      });
    });

    socket.on("typing:stop", ({ conversationId }) => {
      getConversationSubscribers(conversationId).then((clientIds) => {
        clientIds.forEach((cid) => {
          const s = io.sockets.sockets.get(cid);
          if (s && s.data.clientId !== clientId) {
            s.emit("typing:stop", { conversationId, userId });
          }
        });
      });
    });

    // -----------------------------
    // Message send
    // -----------------------------
    socket.on("message:new", async ({ conversationId, text }) => {
      if (!conversationId || !text) return;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { user1Id: true, user2Id: true },
      });
      if (!conversation) return;
      if (userId !== conversation.user1Id && userId !== conversation.user2Id) {
        return;
      }

      const newMessage = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          text,
        },
        include: {
          sender: { select: { id: true, name: true, email: true } },
        },
      });

      const clientIds = await getConversationSubscribers(conversationId);
      for (const cid of clientIds) {
        const clientSocket = io.sockets.sockets.get(cid);
        if (clientSocket) {
          clientSocket.emit("message:new", {
            id: newMessage.id,
            conversationId: newMessage.conversationId,
            senderId: newMessage.sender.id,
            text: newMessage.text,
            createdAt: newMessage.createdAt,
            deliveredAt: newMessage.deliveredAt,
            readAt: newMessage.readAt,
          });
        }
      }
    });

    // -----------------------------
    // Message delivery + read
    // -----------------------------
    socket.on("message:deliver", async ({ conversationId }) => {
      if (!conversationId) return;
      const now = new Date();
      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          deliveredAt: null,
        },
        data: { deliveredAt: now },
      });

      const clientIds = await getConversationSubscribers(conversationId);
      for (const cid of clientIds) {
        const clientSocket = io.sockets.sockets.get(cid);
        clientSocket?.emit("message:delivered", {
          conversationId,
          deliveredAt: now.toISOString(),
        });
      }
    });

    socket.on("message:read", async ({ conversationId }) => {
      if (!conversationId) return;
      const now = new Date();
      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readAt: null,
        },
        data: { readAt: now },
      });

      const clientIds = await getConversationSubscribers(conversationId);
      for (const cid of clientIds) {
        const clientSocket = io.sockets.sockets.get(cid);
        clientSocket?.emit("message:read", {
          conversationId,
          readAt: now.toISOString(),
        });
      }
    });

    // -----------------------------
    // Conversation join/leave
    // -----------------------------
    socket.on("conversation:join", async ({ conversationId }) => {
      if (!conversationId) return;
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { user1Id: true, user2Id: true },
      });
      if (!conversation) return;
      if (userId !== conversation.user1Id && userId !== conversation.user2Id) {
        return;
      }

      await addConversationSubscriber(conversationId, clientId);
      const subs = clientSubscriptions.get(clientId) || new Set();
      subs.add(conversationId);
      clientSubscriptions.set(clientId, subs);

      const now = new Date();
      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readAt: null,
        },
        data: { readAt: now },
      });

      const clientIds = await getConversationSubscribers(conversationId);
      for (const cid of clientIds) {
        const clientSocket = io.sockets.sockets.get(cid);
        clientSocket?.emit("message:read", {
          conversationId,
          readAt: now.toISOString(),
        });
      }
    });

    socket.on("conversation:leave", async ({ conversationId }) => {
      await removeConversationSubscriber(conversationId, clientId);
      const subs = clientSubscriptions.get(clientId);
      subs?.delete(conversationId);
    });

    // -----------------------------
    // Disconnect
    // -----------------------------
    socket.on("disconnect", async () => {
      const subs = clientSubscriptions.get(clientId);
      if (subs) {
        for (const conversationId of subs) {
          await removeConversationSubscriber(conversationId, clientId);
        }
        clientSubscriptions.delete(clientId);
      }

      await removeUserOnlineClient(userId, clientId);
      const count = await getUserOnlineClientCount(userId);
      if (count === 0) {
        io.emit("status:offline", { userId });
        console.log(`❌ status:offline — user ${userId}`);
      }
    });
  });

  return io;
}
