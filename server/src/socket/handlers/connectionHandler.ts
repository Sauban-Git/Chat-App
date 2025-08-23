import { Server as SocketIOServer } from "socket.io";
import type { AuthenticatedSocket } from "../types.js";
import { registerConversationHandlers } from "./conversation.js";
import { registerMessageHandlers } from "./message.js";
import { registerPresenceHandlers } from "./presence.js";

export const handleConnection = (socket: AuthenticatedSocket, io: SocketIOServer) => {
  const userId = socket.data.userId;

  console.log(`✅ User connected: ${userId}`);

  registerConversationHandlers(socket, io);
  registerMessageHandlers(socket, io);
  registerPresenceHandlers(socket, io);

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${userId}`);
    // You can extract disconnection logic later here too
  });
};
