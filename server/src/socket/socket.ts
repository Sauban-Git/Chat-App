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

  console.log(
    `Socket.IO server initialized with CORS origin: ${process.env.CLIENT_URL}`
  );

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

  io.on("connection", async (socket: ExtendedSocket) => {
    const userId = socket.data.userId!;
    const clientId = socket.id;
    socket.data.clientId = clientId;

    console.log(`Socket connected: userId=${userId}, clientId=${clientId}`);

    // Disconnect other sockets for the same user to enforce one connection
    for (const [id, s] of io.sockets.sockets) {
      if (s.data.userId === userId && id !== clientId) {
        console.log(`Disconnecting existing socket ${id} for user ${userId}`);
        s.disconnect(true);
      }
    }

    // Mark user client online in Redis
    await addUserOnlineClient(userId, clientId);

    // Send full online user list to the newly connected client
    const onlineUsers = await getAllOnlineUsers();
    socket.emit("status:online:all", { users: onlineUsers });

    // Broadcast user online immediately
    io.emit("status:online", { userId });
    console.log(`Broadcasted status:online for user ${userId}`);

    // Auto-subscribe client to all conversations where user is participant
    const userConversations = await prisma.conversation.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      select: { id: true },
    });

    const subs = new Set<string>();
    for (const conv of userConversations) {
      await addConversationSubscriber(conv.id, clientId);
      subs.add(conv.id);
    }
    clientSubscriptions.set(clientId, subs);
    await addUserSubscriber(userId, clientId);

    // Listen to client subscription events
    socket.on("subscribe", async (data) => {
      if (data.conversationId) {
        await addConversationSubscriber(data.conversationId, clientId);
        const subs = clientSubscriptions.get(clientId) || new Set();
        subs.add(data.conversationId);
        clientSubscriptions.set(clientId, subs);
        console.log(
          `User ${userId} subscribed to conversation ${data.conversationId}`
        );
      }
      if (data.list === "conversation_list") {
        await addUserSubscriber(userId, clientId);
        console.log(`User ${userId} subscribed to their conversation list`);
      }
    });

    socket.on("typing:start", ({ conversationId }) => {
      const clientId = socket.data.clientId!;
      const userId = socket.data.userId!;

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
      const clientId = socket.data.clientId!;
      const userId = socket.data.userId!;

      getConversationSubscribers(conversationId).then((clientIds) => {
        clientIds.forEach((cid) => {
          const s = io.sockets.sockets.get(cid);
          if (s && s.data.clientId !== clientId) {
            s.emit("typing:stop", { conversationId, userId });
          }
        });
      });
    });

    socket.on("message:new", async (payload) => {
      const { conversationId, text } = payload;
      if (!conversationId || !text) return;

      // Verify user is participant of the conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { user1Id: true, user2Id: true },
      });
      if (!conversation) return;

      if (userId !== conversation.user1Id && userId !== conversation.user2Id) {
        // User not participant, ignore
        return;
      }

      // Create message
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

      // Emit new message to all clients subscribed to this conversation
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
    // ✅ Handle message:deliver
    // -----------------------------
    socket.on("message:deliver", async ({ conversationId }) => {
      if (!conversationId) return;

      const now = new Date();

      // Update all messages in DB from other user in this conversation that are not delivered
      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          deliveredAt: null,
        },
        data: {
          deliveredAt: now,
        },
      });

      // Notify all clients in this conversation
      const clientIds = await getConversationSubscribers(conversationId);
      for (const cid of clientIds) {
        const clientSocket = io.sockets.sockets.get(cid);
        if (clientSocket) {
          clientSocket.emit("message:delivered", {
            conversationId,
            deliveredAt: now.toISOString(),
          });
        }
      }
    });

    // -----------------------------
    // ✅ Handle message:read
    // -----------------------------
    socket.on("message:read", async ({ conversationId }) => {
      if (!conversationId) return;

      const now = new Date();

      // Update all messages from other user in this conversation that are not read
      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readAt: null,
        },
        data: {
          readAt: now,
        },
      });

      // Notify all clients in this conversation
      const clientIds = await getConversationSubscribers(conversationId);
      for (const cid of clientIds) {
        const clientSocket = io.sockets.sockets.get(cid);
        if (clientSocket) {
          clientSocket.emit("message:read", {
            conversationId,
            readAt: now.toISOString(),
          });
        }
      }
    });

    // -----------------------------
    // ✅ Handle conversation:join
    // -----------------------------
    socket.on("conversation:join", async ({ conversationId }) => {
      if (!conversationId) return;

      // Verify user is participant of the conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { user1Id: true, user2Id: true },
      });
      if (!conversation) return;

      if (userId !== conversation.user1Id && userId !== conversation.user2Id) {
        // User not participant, ignore
        return;
      }

      // Subscribe client to this conversation
      await addConversationSubscriber(conversationId, clientId);
      const subs = clientSubscriptions.get(clientId) || new Set();
      subs.add(conversationId);
      clientSubscriptions.set(clientId, subs);

      console.log(`User ${userId} joined conversation ${conversationId}`);

      // 🔹 Auto-mark messages as read when joining
      const now = new Date();

      await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readAt: null,
        },
        data: {
          readAt: now,
        },
      });

      // Notify all clients in this conversation
      const clientIds = await getConversationSubscribers(conversationId);
      for (const cid of clientIds) {
        const clientSocket = io.sockets.sockets.get(cid);
        if (clientSocket) {
          clientSocket.emit("message:read", {
            conversationId,
            readAt: now.toISOString(),
          });
        }
      }
    });

    socket.on("conversation:leave", async ({ conversationId }) => {
      console.log(`🟠 ${socket.id} leaving conversation ${conversationId}`);

      // Remove from Redis subscriptions
      await removeConversationSubscriber(conversationId, clientId);

      // Remove from in-memory subscriptions
      const subs = clientSubscriptions.get(clientId);
      if (subs) subs.delete(conversationId);

      console.log(
        `User ${userId} unsubscribed from conversation ${conversationId}`
      );
    });

    socket.on("disconnect", async () => {
      console.log(`🔴 Socket disconnected: ${socket.id} for user ${userId}`);

      // Unsubscribe this client from all conversations
      const subs = clientSubscriptions.get(clientId);
      if (subs) {
        for (const conversationId of subs) {
          await removeConversationSubscriber(conversationId, clientId);
          console.log(
            `User ${userId} unsubscribed from conversation ${conversationId}`
          );
        }
        clientSubscriptions.delete(clientId);
      }

      // ✅ Remove from Redis presence tracking
      await removeUserOnlineClient(userId, clientId);

      // ✅ Check if user still has other active connections
      const count = await getUserOnlineClientCount(userId);
      if (count === 0) {
        io.emit("status:offline", { userId });
        console.log(`Broadcasted status:offline for user ${userId}`);
      }
    });

    console.log(`Socket connected for user ${userId} client ${clientId}`);
  });

  return io;
}
