import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

import { useUserInfoStore } from "../store/userInfoStore";
import { useUsersListStore } from "../store/conversationListStore";
import { useConversationIdStore } from "../store/conversationIdStore";
import { usePresenceStore } from "../store/userPresenceStore";
import { useMessageListStore } from "../store/messagesListStore";
import type { MessageFromApi, MessageWithSender } from "../types/types";

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

  // Used to track if user switched conversation
  const previousConversationIdRef = useRef<string | null>(null);

  const updateAllUnmarkedMessages = (
    conversationId: string,
    timestamp: string,
    status: "delivered" | "read"
  ) => {
    const isoTimestamp = new Date(timestamp).toISOString();

    useMessageListStore.setState((prev) => {
      const updatedMessages = prev.messageList.map((msg) => {
        const isFromOtherUser = msg.senderId !== user?.id;
        const inConversation = msg.conversationId === conversationId;

        if (!inConversation || !isFromOtherUser) return msg;

        if (status === "delivered" && !msg.deliveredAt) {
          return { ...msg, deliveredAt: isoTimestamp };
        } else if (status === "read" && !msg.readAt) {
          return { ...msg, readAt: isoTimestamp };
        }

        return msg;
      });

      return { messageList: updatedMessages };
    });
  };

  useEffect(() => {
    if (!user) return;

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

    // Incoming messages
    socket.on("message:new", (message: MessageWithSender) => {
      const isFromOtherUser = message.senderId !== user.id;
      const isInCurrentConversation =
        message.conversationId === currentConversationId;

      if (isFromOtherUser && isInCurrentConversation) {
        // Reuse the same event
        socket.emit("message:read", { conversationId: message.conversationId });
      }

      useMessageListStore.setState((prev) => {
        const alreadyExists = prev.messageList.some((m) => m.id === message.id);
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

    socket.on("message:delivered", ({ conversationId, deliveredAt }) => {
      updateAllUnmarkedMessages(conversationId, deliveredAt, "delivered");
    });

    socket.on("message:read", ({ conversationId, readAt }) => {
      updateAllUnmarkedMessages(conversationId, readAt, "read");
    });

    // Graceful disconnect
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
  }, [user]);

  // JOIN/LEAVE conversation logic
  useEffect(() => {
    if (!socketRef.current || !socketRef.current.connected || !user) return;

    const socket = socketRef.current;
    const prevId = previousConversationIdRef.current;
    const currId = currentConversationId;

    if (prevId && prevId !== currId) {
      socket.emit("leave", { conversationId: prevId });
      console.log(`➡️ Left previous conversation: ${prevId}`);
    }

    if (currId && currId !== prevId) {
      socket.emit("join", { conversationId: currId });
      console.log(`⬅️ Joined new conversation: ${currId}`);
    }

    previousConversationIdRef.current = currId;
  }, [currentConversationId]);

  // ---- Emit Handlers ----

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
    emitTyping,
  };
}
