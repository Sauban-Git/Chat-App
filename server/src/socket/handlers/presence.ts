import { Server as SocketIOServer } from "socket.io";
import type { AuthenticatedSocket } from "../types.js";
import { prisma } from "../../db/prisma.js";
import {
  publishPresence,
  publishTypingStatus,
  subscribeToChannel,
  unsubscribeFromChannel,
} from "../../db/redis.js";

export const registerPresenceHandlers = (
  socket: AuthenticatedSocket,
  io: SocketIOServer
) => {
  const userId = socket.data.userId;
  const joinedConversations = new Set<string>();
  const subscribedChannels = new Set<string>();

  // 🔵 Send "online" status to others
  publishPresence(userId, "online");

  (async () => {
    try {
      await prisma.message.updateMany({
        where: {
          senderId: {
            not: userId,
          },
          deliveredAt: null,
          conversation: {
            OR: [{ user1Id: userId }, { user2Id: userId }],
          },
        },
        data: {
          deliveredAt: new Date(),
        },
      });
      console.log(`📬 Marked messages as delivered for user ${userId}`);
    } catch (err) {
      console.error("Failed to mark delivered messages:", err);
    }
  })();

  // 🔴 Send "offline" status on disconnect
  socket.on("disconnect", async () => {
    publishPresence(userId, "offline");

    // Optional: unsubscribe from all Redis channels when socket disconnects
    for (const channel of subscribedChannels) {
      await unsubscribeFromChannel(channel);
    }
    subscribedChannels.clear();
    joinedConversations.clear();
  });

  // 🟡 Typing: Start
  socket.on(
    "typing:start",
    ({ conversationId }: { conversationId: string }) => {
      publishTypingStatus(conversationId, userId, true);
    }
  );

  // 🟠 Typing: Stop
  socket.on("typing:stop", ({ conversationId }: { conversationId: string }) => {
    publishTypingStatus(conversationId, userId, false);
  });

  // 🟢 Join presence/typing for a conversation
  socket.on("presence:join", async (conversationId: string) => {
    if (joinedConversations.has(conversationId)) return;
    joinedConversations.add(conversationId);
    socket.join(conversationId);

    const typingChannel = `conversation:${conversationId}:typing`;

    if (!subscribedChannels.has(typingChannel)) {
      await subscribeToChannel(typingChannel, (_channel, rawMessage) => {
        const { userId: senderId, isTyping } = JSON.parse(rawMessage);
        if (senderId === userId) return; // Do not emit to self

        io.to(conversationId).emit("typing", {
          userId: senderId,
          isTyping,
        });
      });
      subscribedChannels.add(typingChannel);
    }
  });

  // 🟣 Subscribe to presence of users in same conversations
  (async () => {
    try {
      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      });

      for (const convo of conversations) {
        const otherUserId =
          convo.user1Id === userId ? convo.user2Id : convo.user1Id;

        const presenceChannel = `presence:${otherUserId}`;

        if (!subscribedChannels.has(presenceChannel)) {
          await subscribeToChannel(presenceChannel, (_channel, rawMessage) => {
            const { userId: changedUserId, status } = JSON.parse(rawMessage);

            socket.emit("presence:update", {
              userId: changedUserId,
              status, // 'online' or 'offline'
            });
          });
          subscribedChannels.add(presenceChannel);
        }
      }
    } catch (err) {
      console.error("Failed to subscribe to presence channels:", err);
    }
  })();
};
