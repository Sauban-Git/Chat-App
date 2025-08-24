import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

import { useUserInfoStore } from "../store/userInfoStore";
import { useUsersListStore } from "../store/conversationListStore";
import { useConversationIdStore } from "../store/conversationIdStore";
import { usePresenceStore } from "../store/userPresenceStore";
import { useMessageListStore } from "../store/messagesListStore";
import axios from "../utils/axios";

import type { MessageFromApi, MessageWithSender } from "../types/types";

// Socket server URL
const SOCKET_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

// Helper: Update message delivery/read statuses in the message store
const updateAllUnmarkedMessages = (
  conversationId: string,
  timestamp: string,
  status: "delivered" | "read",
  userId: string
) => {
  const isoTimestamp = new Date(timestamp).toISOString();

  useMessageListStore.setState((prev) => {
    const updatedMessages = prev.messageList.map((msg) => {
      const isFromOtherUser = msg.senderId !== userId;
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

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);

  const user = useUserInfoStore((state) => state.user);
  const currentConversationId = useConversationIdStore(
    (state) => state.conversationId
  );

  const setOnlineStatus = usePresenceStore((state) => state.setOnlineStatus);
  const setTypingStatus = usePresenceStore((state) => state.setTypingStatus);
  const updateLastMessage = useUsersListStore(
    (state) => state.updateLastMessage
  );
  const updateUserPresence = useUsersListStore(
    (state) => state.updateUserPresence
  );

  const previousConversationIdRef = useRef<string | null>(null);

  const markMessageDelivered = async () => {
    try {
      await axios.put("/message/deliver");
    } catch (err) {
      console.error("Failed to mark message as delivered", err);
    }
  };

  // Send "read"
  const markMessageRead = async (conversationId: string) => {
    try {
      await axios.put("/message/read", { conversationId });
    } catch (err) {
      console.error("Failed to mark message as read", err);
    }
  };

  useEffect(() => {
    if (!user) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
    });

    socketRef.current = socket;

    // --- Lifecycle Events ---
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      socket.emit("status:online"); // only needed if server tracks presence on explicit emit
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
    });

    // --- Message Events ---
    socket.on("message:new", async (message: MessageWithSender) => {
      const isFromOtherUser = message.senderId !== user.id;
      const isInCurrentConversation =
        message.conversationId === currentConversationId;

      if (isFromOtherUser) {
        await markMessageDelivered();
      }

      if (isFromOtherUser && isInCurrentConversation) {
        socket.emit("message:read", { conversationId: message.conversationId });
        await markMessageRead(message.conversationId);
      }

      // Emit read if message is from other user & we're in that conversation
      if (isFromOtherUser && isInCurrentConversation) {
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

    // --- Typing Events ---
    socket.on("typing:start", ({ conversationId, userId }) => {
      setTypingStatus(conversationId, userId, true);
    });

    socket.on("typing:stop", ({ conversationId, userId }) => {
      setTypingStatus(conversationId, userId, false);
    });

    // --- Presence Events ---
    socket.on("status:online:all", ({ users }: { users: string[] }) => {
      console.log("📡 Received full online users list:", users);
      users.forEach((userId) => {
        setOnlineStatus(userId, true);
        updateUserPresence(userId, true);
      });
    });

    socket.on("status:online", ({ userId }) => {
      console.log(`🟢 User ${userId} is now online (real-time event)`);
      setOnlineStatus(userId, true);
      updateUserPresence(userId, true);
    });

    socket.on("status:offline", ({ userId }) => {
      console.log(`🔴 User ${userId} went offline (real-time event)`);
      setOnlineStatus(userId, false);
      updateUserPresence(userId, false);
    });

    // --- Message Status Updates ---
    socket.on("message:delivered", ({ conversationId, deliveredAt }) => {
      updateAllUnmarkedMessages(
        conversationId,
        deliveredAt,
        "delivered",
        user.id
      );
    });

    socket.on("message:read", ({ conversationId, readAt }) => {
      updateAllUnmarkedMessages(conversationId, readAt, "read", user.id);
    });

    // Graceful cleanup
    const handleBeforeUnload = () => {
      // Do NOT emit status:offline manually — server tracks this
      socket.disconnect();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      console.log("🛑 Socket disconnected due to unmount or logout");
    };
  }, [user]);

  // --- Join/Leave Conversation Rooms ---
  useEffect(() => {
    if (!socketRef.current?.connected || !user) return;

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
  }, [currentConversationId, user]);

  // --- Emit Functions ---
  const emitMessage = useCallback((message: MessageFromApi) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("message:new", message);
    }
  }, []);

  // const emitTyping = useCallback(
  //   (type: "start" | "stop", conversationId: string) => {
  //     if (!socketRef.current?.connected) return;

  //     const event = type === "start" ? "typing:start" : "typing:stop";
  //     socketRef.current.emit(event, { conversationId });
  //   },
  //   []
  // );

  const emitTyping = useCallback(
    (type: "start" | "stop", conversationId: string) => {
      if (!socketRef.current?.connected) return;
      const event = type === "start" ? "typing:start" : "typing:stop";
      socketRef.current.emit(event, { conversationId });
    },
    []
  );

  return {
    emitMessage,
    emitTyping,
  };
}
