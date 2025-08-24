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

// Debounce broadcasting user online status to avoid spamming on rapid reconnects
const broadcastTimers = new Map<string, NodeJS.Timeout>();

function broadcastOnlineStatus(io: SocketIOServer, userId: string) {
  io.emit("status:online", { userId });
  console.log(`Broadcasted status:online for user ${userId}`);
}

export async function setupSocket(server: HttpServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
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
    const clientId = socket.id; // socket.io id
    socket.data.userId = userId;
    socket.data.clientId = clientId;

    console.log(`Socket connected: userId=${userId}, clientId=${clientId}`);

    // Mark user client online in Redis
    await addUserOnlineClient(userId, clientId);

    // Send full online user list to the newly connected client
    const onlineUsers = await getAllOnlineUsers();
    socket.emit("status:online:all", { users: onlineUsers });

    // Broadcast to all others that this user is online (debounced)
    broadcastOnlineStatus(io, userId);

    // Auto-subscribe client to all conversations where user is user1 or user2
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

    // Listen for sending new messages
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

    // Client disconnect handler
    socket.on("disconnect", async () => {
      console.log(
        `Socket disconnected: userId=${userId}, clientId=${clientId}`
      );
      await removeUserOnlineClient(userId, clientId);

      // Check if user still online on other clients
      const remaining = await getUserOnlineClientCount(userId);
      if (remaining === 0) {
        io.emit("status:offline", { userId });
        console.log(`User ${userId} is OFFLINE`);
      }

      await removeUserSubscriber(userId, clientId);

      const subs = clientSubscriptions.get(clientId);
      if (subs) {
        for (const convId of subs) {
          await removeConversationSubscriber(convId, clientId);
        }
      }
      clientSubscriptions.delete(clientId);
      console.log(`Socket disconnected for user ${userId} client ${clientId}`);
    });

    console.log(`Socket connected for user ${userId} client ${clientId}`);
  });

  return io;
}
