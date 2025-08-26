import { useEffect, useRef, useCallback } from "react";
import { socket } from "../utils/socket";
import { useUserInfoStore } from "../store/userInfoStore";
import { useConversationIdStore } from "../store/conversationIdStore";
import { usePresenceStore } from "../store/userPresenceStore";
import { useUsersListStore } from "../store/conversationListStore";
import { useMessageListStore } from "../store/messagesListStore";
import type {
  Conversation,
  MessageFromApi,
  MessageWithSender,
} from "../types/types";
import useUserOnlineStatusStore from "../store/userOnlineStatusStore";

const updateAllUnmarkedMessages = (
  conversationId: string,
  timestamp: string,
  status: "delivered" | "read"
) => {
  const iso = new Date(timestamp).toISOString();
  useMessageListStore.setState((prev) => {
    const map = { ...prev.messageMap };
    Object.values(map).forEach((m) => {
      if (m.conversationId !== conversationId) return;
      if (status === "delivered" && !m.deliveredAt)
        map[m.id] = { ...m, deliveredAt: iso };
      if (status === "read" && !m.readAt) map[m.id] = { ...m, readAt: iso };
    });
    return { messageMap: map };
  });
};

export function useWebSocket() {
  const user = useUserInfoStore((s) => s.user);
  const currentConversationId = useConversationIdStore((s) => s.conversationId);
  const recipientId = useConversationIdStore((s) => s.recipientId)
  const setUserStatus = useUserOnlineStatusStore(
    (state) => state.setUserStatus
  );

  const setTypingStatus = usePresenceStore((s) => s.setTypingStatus);
  const updateLastMessage = useUsersListStore((s) => s.updateLastMessage);

  const currentConvRef = useRef<string | null>(null);
  useEffect(() => {
    currentConvRef.current = currentConversationId;
  }, [currentConversationId]);

  const isOnline = useUserOnlineStatusStore((state) =>
  recipientId ? state.usersStatus[recipientId] : false
);

useEffect(() => {
  if (recipientId && isOnline === undefined) {
    console.log("⚠️ Recipient status missing, refetching...");
    socket.emit("request:online:all");
  }
}, []);

  useEffect(() => {
    if (!user) return;
    if (!socket.connected) socket.connect();

    // ---------------------------
    // Event Handlers
    // ---------------------------
    const onConnect = () => {
      console.log("✅ Socket connected:", socket.id);

      // Request full online list on connect
      socket.emit("request:online:all");

      // Join current conversation
      if (currentConvRef.current) {
        socket.emit("conversation:join", {
          conversationId: currentConvRef.current,
        });
      }
    };

    const onDisconnect = (reason: string) => {
      console.log("❌ Socket disconnected:", reason);
    };

    // Correct typing for the parameter — an object mapping userId to boolean
    const onOnlineAll = (allOnlineUsers: { [userId: string]: boolean }) => {
      setUserStatus(allOnlineUsers);
      console.log("getting allonlineusers listt from server", allOnlineUsers);
    };

    // const onOnline = ({ userId }: { userId: string }) => {
    //   setOnlineStatus(userId, true);
    //   updateUserPresence(userId, true);
    // };

    // const onOffline = ({ userId }: { userId: string }) => {
    //   setOnlineStatus(userId, false);
    //   updateUserPresence(userId, false);
    // };

    const onTypingStart = ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => setTypingStatus(conversationId, userId, true);

    const onTypingStop = ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) => setTypingStatus(conversationId, userId, false);

    const onMessageNew = (message: MessageWithSender) => {
      useMessageListStore.getState().addOrUpdateMessage(message);
      updateLastMessage(message.conversationId, message);
    };

    const onConversationNew = (conversation: Conversation) => {
      if (conversation.lastMessage)
        updateLastMessage(conversation.id, conversation.lastMessage);
    };

    const onDelivered = ({
      conversationId,
      deliveredAt,
    }: {
      conversationId: string;
      deliveredAt: string;
    }) => updateAllUnmarkedMessages(conversationId, deliveredAt, "delivered");

    const onRead = ({
      conversationId,
      readAt,
    }: {
      conversationId: string;
      readAt: string;
    }) => updateAllUnmarkedMessages(conversationId, readAt, "read");

    // ---------------------------
    // Register listeners
    // ---------------------------
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("status:online:all", onOnlineAll);
    // socket.on("status:online", onOnline);
    // socket.on("status:offline", onOffline);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    socket.on("message:new", onMessageNew);
    socket.on("conversation:new", onConversationNew);
    socket.on("message:delivered", onDelivered);
    socket.on("message:read", onRead);

    const handleBeforeUnload = () => socket.disconnect();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("status:online:all", onOnlineAll);
      // socket.off("status:online", onOnline);
      // socket.off("status:offline", onOffline);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      socket.off("message:new", onMessageNew);
      socket.off("conversation:new", onConversationNew);
      socket.off("message:delivered", onDelivered);
      socket.off("message:read", onRead);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user]);
}

/**
 * Use this in any component to emit events without adding listeners.
 */
export function useSocketEmitters() {
  const emitMessage = useCallback((message: MessageFromApi) => {
    if (socket.connected) socket.emit("message:new", message);
  }, []);

  const emitTyping = useCallback(
    (type: "start" | "stop", conversationId: string) => {
      if (!socket.connected) return;
      socket.emit(type === "start" ? "typing:start" : "typing:stop", {
        conversationId,
      });
    },
    []
  );

  return { emitMessage, emitTyping };
}
