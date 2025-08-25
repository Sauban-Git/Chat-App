// useSocket.ts
import { useCallback, useEffect, useRef } from "react";

import { useUserInfoStore } from "../store/userInfoStore";
import { useConversationIdStore } from "../store/conversationIdStore";
import { usePresenceStore } from "../store/userPresenceStore";
import { useUsersListStore } from "../store/conversationListStore";
import { useMessageListStore } from "../store/messagesListStore";
import type { Conversation, MessageFromApi, MessageWithSender } from "../types/types";
import { socket } from "../utils/socket";

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
      if (status === "delivered" && !m.deliveredAt) map[m.id] = { ...m, deliveredAt: iso };
      if (status === "read" && !m.readAt) map[m.id] = { ...m, readAt: iso };
    });
    return { messageMap: map };
  });
};

/**
 * Mount this ONCE at the app root (e.g., in App.tsx).
 * It registers listeners and connects the singleton socket.
 */
export function useWebSocket() {
  const user = useUserInfoStore((s) => s.user);
  const currentConversationId = useConversationIdStore((s) => s.conversationId);

  const setOnlineStatus = usePresenceStore((s) => s.setOnlineStatus);
  const setTypingStatus = usePresenceStore((s) => s.setTypingStatus);
  const updateLastMessage = useUsersListStore((s) => s.updateLastMessage);
  const updateUserPresence = useUsersListStore((s) => s.updateUserPresence);

  const currentConvRef = useRef<string | null>(null);
  useEffect(() => {
    currentConvRef.current = currentConversationId;
  }, [currentConversationId]);

  useEffect(() => {
    if (!user) return;

    if (!socket.connected) socket.connect();

    const onConnect = async () => {
      console.log("✅ Socket connected:", socket.id);

      // ---------------------------
      // Step 1: Fetch and update all online users immediately
      // ---------------------------
      socket.emit("request:online:all"); // Or use your server API to get online users
      // We'll handle the response in `status:online:all` listener

      // Step 2: Join the current conversation
      const cid = currentConvRef.current;
      if (cid) socket.emit("conversation:join", { conversationId: cid });
    };

    const onDisconnect = (reason: string) => {
      console.log("❌ Socket disconnected:", reason);
    };

    // ---------------------------
    // Event handlers
    // ---------------------------
    const onMessageNew = (message: MessageWithSender) => {
      const isFromOther = message.senderId !== user.id;
      const isInCurrent = message.conversationId === currentConvRef.current;

      if (isFromOther && !isInCurrent) {
        socket.emit("message:delivered", { conversationId: message.conversationId });
      }
      if (isFromOther && isInCurrent) {
        socket.emit("message:read", { conversationId: message.conversationId });
      }

      useMessageListStore.getState().addOrUpdateMessage(message);
      updateLastMessage(message.conversationId, message);
    };

    const onConversationNew = (conversation: Conversation) => {
      if (conversation.lastMessage) {
        updateLastMessage(conversation.id, conversation.lastMessage);
      }
    };

    const onTypingStart = ({ conversationId, userId }: {conversationId: string, userId: string}) =>
      setTypingStatus(conversationId, userId, true);
    const onTypingStop = ({ conversationId, userId }: {conversationId: string, userId: string}) =>
      setTypingStatus(conversationId, userId, false);

    // ---------------------------
    // Online/offline
    // ---------------------------
    const onOnlineAll = ({ users }: { users: string[] }) => {
      // Immediately update store for all online users
      users.forEach((uid) => {
        setOnlineStatus(uid, true);
        updateUserPresence(uid, true);
      });
    };

    const onOnline = ({ userId }: {userId: string}) => {
      setOnlineStatus(userId, true);
      updateUserPresence(userId, true);
    };

    const onOffline = ({ userId }: {userId: string}) => {
      setOnlineStatus(userId, false);
      updateUserPresence(userId, false);
    };

    const onDelivered = ({ conversationId, deliveredAt }: {conversationId: string, deliveredAt: string}) =>
      updateAllUnmarkedMessages(conversationId, deliveredAt, "delivered");

    const onRead = ({ conversationId, readAt }: {conversationId: string, readAt: string}) =>
      updateAllUnmarkedMessages(conversationId, readAt, "read");

    // ---------------------------
    // Register listeners
    // ---------------------------
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("message:new", onMessageNew);
    socket.on("conversation:new", onConversationNew);
    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    socket.on("status:online:all", onOnlineAll);
    socket.on("status:online", onOnline);
    socket.on("status:offline", onOffline);
    socket.on("message:delivered", onDelivered);
    socket.on("message:read", onRead);

    const handleBeforeUnload = () => socket.disconnect();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("message:new", onMessageNew);
      socket.off("conversation:new", onConversationNew);
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      socket.off("status:online:all", onOnlineAll);
      socket.off("status:online", onOnline);
      socket.off("status:offline", onOffline);
      socket.off("message:delivered", onDelivered);
      socket.off("message:read", onRead);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user]);
}


/**
 * Use this in any component to emit events without adding listeners or touching connection state.
 */
export function useSocketEmitters() {
  const emitMessage = useCallback((message: MessageFromApi) => {
    if (socket.connected) socket.emit("message:new", message);
  }, []);

  const emitTyping = useCallback((type: "start" | "stop", conversationId: string) => {
    if (!socket.connected) return;
    const event = type === "start" ? "typing:start" : "typing:stop";
    socket.emit(event, { conversationId });
  }, []);

  return { emitMessage, emitTyping };
}
