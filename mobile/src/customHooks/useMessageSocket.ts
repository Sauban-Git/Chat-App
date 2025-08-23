import { useEffect, useCallback } from "react";
import { useMessageListStore } from "../store/messagesListStore";
import { useConversationIdStore } from "../store/conversationIdStore";
import { socket } from "../utils/socket";
import type { MessageFromApi } from "../types/types";

interface SendMessagePayload {
  conversationId: string;
  text: string;
}

export const useMessageSocket = () => {
  const conversationId = useConversationIdStore((state) => state.conversationId);
  const { setMessageList } = useMessageListStore();

  // Join message channel on conversationId change
  useEffect(() => {
    if (!conversationId) return;

    socket.emit("message:join", conversationId);

    return () => {
      socket.emit("message:leave", conversationId);
      setMessageList([]); // optionally clear on leave
    };
  }, [conversationId, setMessageList]);

  // Listen for single new messages
  useEffect(() => {
    const handleNewMessage = (message: MessageFromApi) => {
      if (message.conversationId !== conversationId) return;

      setMessageList((prev) => {
        const exists = prev.some((msg) => msg.id === message.id);
        return exists ? prev : [...prev, message];
      });
    };

    socket.on("message:new", handleNewMessage);

    return () => {
      socket.off("message:new", handleNewMessage);
    };
  }, [conversationId, setMessageList]);

  // Send a message to current conversation
  const sendMessage = useCallback(
    ({ conversationId, text }: SendMessagePayload) => {
      if (!conversationId || !text.trim()) return;

      socket.emit("message:send", { conversationId, text });
    },
    []
  );

  return { sendMessage };
};
