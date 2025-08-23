import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";



import type { MessageFromApi } from "../types/types";
import { useUserInfoStore } from "../store/userInfoStore";
import { useMessageListStore } from "../store/messagesListStore";
import { useUsersListStore } from "../store/conversationListStore";
import { useComponentsDisplayStore } from "../store/componentToRenderStore";

const SOCKET_URL = "http://localhost:3000"; // Update if needed

export const useWebsocket = () => {
  const socketRef = useRef<Socket | null>(null);

  const user = useUserInfoStore((state) => state.user);
  const setMessageList = useMessageListStore((state) => state.setMessageList);
  const fetchUsers = useUsersListStore((state) => state.fetchUsers);
  const setMessageDisplay = useComponentsDisplayStore((state) => state.setMessageDisplay);

  useEffect(() => {
    if (!user) return;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to websocket");
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from websocket");
    });

    // ✅ Incoming message
    socket.on("message:new", (message: MessageFromApi) => {
      setMessageList((prev) => [...prev, message]);
    });

    // ✅ Message delivered
    socket.on("message:delivered", ({ messageId, deliveredAt }) => {
      setMessageList((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                statuses: [
                  ...(msg.statuses || []),
                  { status: "DELIVERED", updatedAt: deliveredAt },
                ],
              }
            : msg
        )
      );
    });

    // ✅ Message read
    socket.on("message:read", ({ messageId, readAt }) => {
      setMessageList((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                statuses: [
                  ...(msg.statuses || []),
                  { status: "READ", updatedAt: readAt },
                ],
              }
            : msg
        )
      );
    });

    // ✅ Typing update
    socket.on("typing:update", (data) => {
      console.log("✍️ Typing update:", data);
      // Optional: update typing indicator
    });

    // ✅ Presence update
    socket.on("presence:update", () => {
      console.log("👤 Presence update");
      fetchUsers(); // refresh presence
    });

    return () => {
      socket.disconnect();
    };
  }, [user, fetchUsers, setMessageList]);

  const joinConversation = (conversationId: string) => {
    socketRef.current?.emit("conversation:join", conversationId);
    setMessageDisplay(true);
  };

  const leaveConversation = (conversationId: string) => {
    socketRef.current?.emit("conversation:leave", conversationId);
    setMessageDisplay(false);
  };

  const sendMessage = (conversationId: string, content: string) => {
    socketRef.current?.emit("message:send", { conversationId, text: content });
  };

  const startTyping = (conversationId: string) => {
    socketRef.current?.emit("typing:start", { conversationId });
  };

  const stopTyping = (conversationId: string) => {
    socketRef.current?.emit("typing:stop", { conversationId });
  };

  return {
    joinConversation,
    leaveConversation,
    sendMessage,
    startTyping,
    stopTyping,
    socket: socketRef.current,
  };
};
