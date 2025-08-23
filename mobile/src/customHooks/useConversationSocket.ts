import { useEffect, useCallback } from "react";
import { socket } from "../utils/socket";
import { useUsersListStore } from "../store/conversationListStore";
import type { User } from "../store/conversationListStore"; // type-only import
import { useErrorContentStore } from "../store/errorStore";

export const useConversationSocket = (userId: string) => {
  const updateLastMessage = useUsersListStore((state) => state.updateLastMessage);
  const setErrorContent = useErrorContentStore((s)=> s.setErrorContent); // assuming you have error handling here

  // Initiate a conversation with recipient user
  const initiateConversation = useCallback(
    (recipientId: string, callback: (conversationId: string) => void) => {
      socket.emit("conversation:initiate", { recipientId }, (response: { conversationId: string }) => {
        if (response?.conversationId) {
          callback(response.conversationId);
        } else {
          setErrorContent("Failed to start conversation.", true);
        }
      });
    },
    [setErrorContent]
  );

  // Join a conversation room to start receiving messages
  const joinConversation = useCallback(
    (conversationId: string) => {
      socket.emit("conversation:join", conversationId);
    },
    []
  );

  // Leave a conversation room to stop receiving messages
  const leaveConversation = useCallback(
    (conversationId: string) => {
      socket.emit("conversation:leave", conversationId);
    },
    []
  );

  useEffect(() => {
    if (!userId) return;

    // Handle incoming conversation messages
    const handleConversationMessage = (data: {
      userId: string;
      message: NonNullable<User["conversation"]>["lastMessage"];
      conversationId: string;
      timestamp: string;
    }) => {
      updateLastMessage(data.conversationId, data.message);
    };

    // Handle errors from server about conversation
    const handleConversationError = (error: { message: string }) => {
      setErrorContent(error.message, true);
    };

    socket.on("conversation:message", handleConversationMessage);
    socket.on("conversation:error", handleConversationError);

    return () => {
      socket.off("conversation:message", handleConversationMessage);
      socket.off("conversation:error", handleConversationError);
    };
  }, [userId, updateLastMessage, setErrorContent]);

  return {
    initiateConversation,
    joinConversation,
    leaveConversation,
  };
};
