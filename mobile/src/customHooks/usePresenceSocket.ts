// src/customHooks/usePresenceSocket.ts
import { useEffect } from "react";
import { socket } from "../utils/socket";
import { useConversationIdStore } from "../store/conversationIdStore";
import { usePresenceStore } from "../store/userPresenceStore";

export const usePresenceSocket = (userId: string) => {
  const conversationId = useConversationIdStore((state) => state.conversationId);
  const setTypingStatus = usePresenceStore((state) => state.setTypingStatus);
  const setOnlineStatus = usePresenceStore((state) => state.setOnlineStatus);

  // Join presence/typing socket room
  useEffect(() => {
    if (!conversationId) return;
    socket.emit("presence:join", conversationId);
  }, [conversationId]);

  // Listen to typing events
  useEffect(() => {
    const handleTyping = (data: { userId: string; isTyping: boolean }) => {
      const { userId: typingUserId, isTyping } = data;
      setTypingStatus(conversationId, typingUserId, isTyping);
    };

    socket.on("typing", handleTyping);
    return () => {
      socket.off("typing", handleTyping);
    };
  }, [conversationId, setTypingStatus]);

  // Listen to presence updates
  useEffect(() => {
    const handlePresenceUpdate = (data: { userId: string; status: "online" | "offline" }) => {
      const { userId: changedUserId, status } = data;
      if (changedUserId === userId) return; // skip self
      setOnlineStatus(changedUserId, status === "online");
    };

    socket.on("presence:update", handlePresenceUpdate);
    return () => {
      socket.off("presence:update", handlePresenceUpdate);
    };
  }, [setOnlineStatus, userId]);

  // Emit typing start
  const startTyping = () => {
    if (conversationId) {
      socket.emit("typing:start", { conversationId });
    }
  };

  // Emit typing stop
  const stopTyping = () => {
    if (conversationId) {
      socket.emit("typing:stop", { conversationId });
    }
  };

  return {
    startTyping,
    stopTyping,
  };
};
