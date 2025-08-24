import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

import { useUserInfoStore } from "../store/userInfoStore";
import { useUsersListStore } from "../store/conversationListStore";
import { useConversationIdStore } from "../store/conversationIdStore";
import { usePresenceStore } from "../store/userPresenceStore";
import { useMessageListStore } from "../store/messagesListStore";
import type { MessageFromApi } from "../types/types";

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const user = useUserInfoStore((state) => state.user);

  const setOnlineStatus = usePresenceStore((state) => state.setOnlineStatus);
  const setTypingStatus = usePresenceStore((state) => state.setTypingStatus);
  const updateLastMessage = useUsersListStore(
    (state) => state.updateLastMessage
  );
  const updateUserPresence = useUsersListStore(
    (state) => state.updateUserPresence
  );
  const currentConversationId = useConversationIdStore(
    (state) => state.conversationId
  );

  // Update message list store for delivered/read status
  const updateMessageStatus = (
    conversationId: string,
    messageIds: string[],
    status: "delivered" | "read",
    timestamp: string
  ) => {
    const date = new Date(timestamp); // convert string to Date

    useMessageListStore.setState((prev) => {
      const updatedMessages = prev.messageList.map((msg) => {
        if (messageIds.includes(msg.id)) {
          if (status === "delivered") {
            return { ...msg, deliveredAt: date };
          } else if (status === "read") {
            return { ...msg, readAt: date };
          }
        }
        return msg;
      });

      return { messageList: updatedMessages };
    });
  };

  useEffect(() => {
    if (user) {
      const socket = io(SOCKET_URL, {
        withCredentials: true,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("✅ Socket connected:", socket.id);
        socket.emit("status:online");
      });

      socket.on("disconnect", (reason) => {
        console.log("❌ Socket disconnected:", reason);
      });

      // Incoming events
      socket.on("message:new", (message) => {
        useMessageListStore.setState((prev) => {
          const alreadyExists = prev.messageList.some(
            (m) => m.id === message.id
          );
          if (alreadyExists) return prev;

          return {
            messageList: [...prev.messageList, message],
          };
        });

        updateLastMessage(message.conversationId, message);
      });

      socket.on("conversation:new", (conversation) => {
        if (conversation.lastMessage) {
          updateLastMessage(conversation.id, conversation.lastMessage);
        }
      });

      socket.on("typing:start", ({ conversationId, userId }) => {
        setTypingStatus(conversationId, userId, true);
      });

      socket.on("typing:stop", ({ conversationId, userId }) => {
        setTypingStatus(conversationId, userId, false);
      });

      socket.on("status:online", ({ userId }) => {
        console.log("Received status:online for", userId);
        setOnlineStatus(userId, true);
        updateUserPresence(userId, true);
      });

      socket.on("status:offline", ({ userId }) => {
        setOnlineStatus(userId, false);
        updateUserPresence(userId, false);
      });

      // ** New: handle delivered and read message events **
      socket.on(
        "message:delivered",
        ({ conversationId, messageIds, deliveredAt }) => {
          // messageIds is an array of IDs that were marked delivered
          updateMessageStatus(
            conversationId,
            messageIds,
            "delivered",
            deliveredAt
          );
        }
      );

      socket.on("message:read", ({ conversationId, messageIds, readAt }) => {
        // messageIds is an array of IDs that were marked read
        updateMessageStatus(conversationId, messageIds, "read", readAt);
      });

      // Auto-disconnect on unmount or user logout
      const handleBeforeUnload = () => {
        socket.emit("status:offline", { userId: user.id });
      };

      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        socket.emit("status:offline", { userId: user.id });
        socket.disconnect();
        socketRef.current = null;
        window.removeEventListener("beforeunload", handleBeforeUnload);
        console.log("🛑 Socket disconnected due to unmount or logout");
      };
    }
  }, [user, currentConversationId]);

  // ---- EMIT HANDLERS ----

  const emitMessage = (message: MessageFromApi) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("message:new", message);
    }
  };

  const emitTyping = (
    type: "start" | "stop",
    conversationId: string,
    userId: string
  ) => {
    if (!socketRef.current?.connected) return;

    if (type === "start") {
      socketRef.current.emit("typing:start", { conversationId, userId });
    } else {
      socketRef.current.emit("typing:stop", { conversationId, userId });
    }
  };

  return {
    emitMessage,
    emitTyping, // 👈 expose typing emitter
  };
}
