import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

import { useUserInfoStore } from "../store/userInfoStore";
import { useUsersListStore } from "../store/conversationListStore";
import { useConversationIdStore } from "../store/conversationIdStore";
import { usePresenceStore } from "../store/userPresenceStore";
import { useMessageListStore } from "../store/messagesListStore";

import type { MessageFromApi, MessageWithSender } from "../types/types";

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const updateAllUnmarkedMessages = (
  conversationId: string,
  timestamp: string,
  status: "delivered" | "read"
) => {
  const isoTimestamp = new Date(timestamp).toISOString();

  useMessageListStore.setState((prev) => {
    const updatedMap = { ...prev.messageMap };

    Object.values(updatedMap).forEach((msg) => {
      const inConversation = msg.conversationId === conversationId;
      if (!inConversation) return;

      if (status === "delivered" && !msg.deliveredAt) {
        updatedMap[msg.id] = { ...msg, deliveredAt: isoTimestamp };
      } else if (status === "read" && !msg.readAt) {
        updatedMap[msg.id] = { ...msg, readAt: isoTimestamp };
      }
    });

    return { messageMap: updatedMap };
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

  useEffect(() => {
    if (!user) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
    });

    socket.on("message:new", async (message: MessageWithSender) => {
      const isFromOtherUser = message.senderId !== user.id;
      const isInCurrentConversation =
        message.conversationId === currentConversationId;

      if (isFromOtherUser && !isInCurrentConversation) {
        socket.emit("message:delivered", {
          conversationId: message.conversationId,
        });
      }

      if (isFromOtherUser && isInCurrentConversation) {
        socket.emit("message:read", { conversationId: message.conversationId });
      }

      // Add or update message in store
      useMessageListStore.getState().addOrUpdateMessage(message);

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

    socket.on("status:online:all", ({ users }: { users: string[] }) => {
      users.forEach((userId) => {
        setOnlineStatus(userId, true);
        updateUserPresence(userId, true);
      });
    });

    socket.on("status:online", ({ userId }) => {
      setOnlineStatus(userId, true);
      updateUserPresence(userId, true);
    });

    socket.on("status:offline", ({ userId }) => {
      setOnlineStatus(userId, false);
      updateUserPresence(userId, false);
    });

    socket.on("message:delivered", ({ conversationId, deliveredAt }) => {
      console.log("MessageDelivered");
      updateAllUnmarkedMessages(conversationId, deliveredAt, "delivered");
    });

    socket.on("message:read", ({ conversationId, readAt }) => {
      console.log("MessageRead");
      updateAllUnmarkedMessages(conversationId, readAt, "read");
    });

    const handleBeforeUnload = () => {
      socket.disconnect();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      socket.disconnect();
      socketRef.current = null;
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user]);

  useEffect(() => {
    if (!socketRef.current?.connected || !user) return;

    const socket = socketRef.current;
    const prevId = previousConversationIdRef.current;
    const currId = currentConversationId;

    if (prevId && prevId !== currId) {
      socket.emit("conversation:leave", { conversationId: prevId });
    }

    if (currId && currId !== prevId) {
      socket.emit("conversation:join", { conversationId: currId });
    }

    previousConversationIdRef.current = currId;
  }, [currentConversationId, user]);

  const emitMessage = useCallback((message: MessageFromApi) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("message:new", message);
    }
  }, []);

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
