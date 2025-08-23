import { Server as SocketIOServer } from "socket.io";
import { publishTypingStatus, publishPresence } from "../../db/redis.js";
import type { AuthenticatedSocket } from "../types.js";

export const registerPresenceHandlers = (
  socket: AuthenticatedSocket,
  io: SocketIOServer
) => {
  const userId = socket.data.userId;

  // Typing
  socket.on("typing:start", ({ conversationId }: {conversationId: string}) => {
    publishTypingStatus(conversationId, userId, true);
  });

  socket.on("typing:stop", ({ conversationId }: {conversationId: string}) => {
    publishTypingStatus(conversationId, userId, false);
  });

  socket.on("disconnect", () => {
    publishPresence(userId, "offline");
  });

  publishPresence(userId, "online");
};
