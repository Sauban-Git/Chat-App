import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import {
  addConversationSubscriber,
  addUserSubscriber,
  getConversationSubscribers,
  removeConversationSubscriber,
  markUserOnline,
  markUserOffline,
  getAllOnlineUsers,
} from "../db/redis.js";
import { prisma } from "../db/prisma.js";
import { JWT_SECRET } from "../config/jwt.js";

type ExtendedSocket = Socket & { userId?: string; clientId?: string };

const clientSubscriptions = new Map<string, Set<string>>();

export async function setupSocket(server: HttpServer) {
  const io = new SocketIOServer(server, {
    cors: { origin: process.env.CLIENT_URL, methods: ["GET", "POST"], credentials: true },
    pingTimeout: 10000,
    pingInterval: 5000,
  });

  // Redis Adapter for scaling
  const pubClient = createClient({ url: process.env.REDIS_URL! });
  const subClient = pubClient.duplicate();
  await pubClient.connect();
  await subClient.connect();
  io.adapter(createAdapter(pubClient, subClient) as any);

  // -----------------------------
  // Authentication middleware
  // -----------------------------
  io.use((socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie;
      if (!cookies) return next(new Error("No cookies found"));

      const parsed = cookie.parse(cookies);
      const token = parsed.token;
      if (!token) return next(new Error("Token not found"));

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      if (!decoded.userId) return next(new Error("Invalid token"));

      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket: ExtendedSocket) => {
    const userId = socket.data.userId!;
    const clientId = socket.id;
    socket.data.clientId = clientId;

    // Disconnect other sockets for the same user
    for (const [id, s] of io.sockets.sockets) {
      if (s.data.userId === userId && id !== clientId) s.disconnect(true);
    }

    // -----------------------------
    // Mark user online
    // -----------------------------
    await markUserOnline(userId);

    // Send full online list
    const onlineUsers = await getAllOnlineUsers();
    console.log("Online Users: ", onlineUsers);
    socket.emit("status:online:all", { users: onlineUsers });

    // Broadcast to others
    io.emit("status:online", { userId });

    // -----------------------------
    // Subscribe to conversations
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
    // Typing / messaging
    // -----------------------------
    const handleTyping = async (event: "typing:start" | "typing:stop", conversationId: string) => {
      const cids = await getConversationSubscribers(conversationId);
      for (const cid of cids) {
        const s = io.sockets.sockets.get(cid);
        if (s && s.data.clientId !== clientId) s.emit(event, { conversationId, userId });
      }
    };

    socket.on("typing:start", ({ conversationId }) => handleTyping("typing:start", conversationId));
    socket.on("typing:stop", ({ conversationId }) => handleTyping("typing:stop", conversationId));

    const handleMessageUpdate = async (type: "delivered" | "read", conversationId: string) => {
      const now = new Date();
      const where = { conversationId, senderId: { not: userId }, [`${type}At`]: null } as any;
      const data = { [`${type}At`]: now } as any;
      await prisma.message.updateMany({ where, data });

      const cids = await getConversationSubscribers(conversationId);
      for (const cid of cids) {
        const s = io.sockets.sockets.get(cid);
        s?.emit(`message:${type}`, { conversationId, [`${type}At`]: now.toISOString() });
      }
    };

    socket.on("message:new", async ({ conversationId, text }) => {
      if (!conversationId || !text) return;

      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { user1Id: true, user2Id: true },
      });
      if (!conv || (userId !== conv.user1Id && userId !== conv.user2Id)) return;

      const newMessage = await prisma.message.create({
        data: { conversationId, senderId: userId, text },
        include: { sender: { select: { id: true, name: true, email: true } } },
      });

      const cids = await getConversationSubscribers(conversationId);
      for (const cid of cids) {
        const s = io.sockets.sockets.get(cid);
        s?.emit("message:new", {
          id: newMessage.id,
          conversationId: newMessage.conversationId,
          senderId: newMessage.sender.id,
          text: newMessage.text,
          createdAt: newMessage.createdAt,
          deliveredAt: newMessage.deliveredAt,
          readAt: newMessage.readAt,
        });
      }
    });

    socket.on("message:deliver", ({ conversationId }) => handleMessageUpdate("delivered", conversationId));
    socket.on("message:read", ({ conversationId }) => handleMessageUpdate("read", conversationId));

    // -----------------------------
    // Join / leave conversations
    // -----------------------------
    socket.on("conversation:join", async ({ conversationId }) => {
      if (!conversationId) return;

      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { user1Id: true, user2Id: true },
      });
      if (!conv || (userId !== conv.user1Id && userId !== conv.user2Id)) return;

      await addConversationSubscriber(conversationId, clientId);
      const subs = clientSubscriptions.get(clientId) || new Set();
      subs.add(conversationId);
      clientSubscriptions.set(clientId, subs);
    });

    socket.on("conversation:leave", async ({ conversationId }) => {
      await removeConversationSubscriber(conversationId, clientId);
      clientSubscriptions.get(clientId)?.delete(conversationId);
    });

    // -----------------------------
    // Support request:online:all
    // -----------------------------
    socket.on("request:online:all", async () => {
      const allOnline = await getAllOnlineUsers();
      socket.emit("status:online:all", { users: allOnline });
    });

    // -----------------------------
    // Disconnect
    // -----------------------------
    socket.on("disconnect", async () => {
      clientSubscriptions.get(clientId)?.forEach(async (convId) => await removeConversationSubscriber(convId, clientId));
      clientSubscriptions.delete(clientId);

      const activeSockets = [...io.sockets.sockets.values()].filter((s) => s.data.userId === userId);
      if (activeSockets.length === 0) {
        await markUserOffline(userId);
        io.emit("status:offline", { userId });
      }

      const onlineUsers = await getAllOnlineUsers();
      console.log("💚 Online users:", onlineUsers);
    });
  });

  return io;
}
