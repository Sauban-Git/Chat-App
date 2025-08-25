import { create } from "zustand";
import type {  MessageWithSender } from "../types/types";

type MessageStatus = "delivered" | "read";

interface MessageListState {
  messageMap: Record<string, MessageWithSender>;
  setMessageList: (
    value: MessageWithSender[] | ((prev: MessageWithSender[]) => MessageWithSender[])
  ) => void;
  updateMessageStatus: (
    conversationId: string,
    status: MessageStatus,
    timestamp: string,
    currentUserId: string
  ) => void;
  addOrUpdateMessage: (message: MessageWithSender) => void;
}

export const useMessageListStore = create<MessageListState>((set) => ({
  messageMap: {},

  setMessageList: (value) =>
    typeof value === "function"
      ? set((state) => {
          const newList = value(Object.values(state.messageMap));
          const newMap: Record<string, MessageWithSender> = {};
          newList.forEach((msg) => {
            newMap[msg.id] = msg;
          });
          return { messageMap: newMap };
        })
      : set(() => {
          const newMap: Record<string, MessageWithSender> = {};
          value.forEach((msg) => {
            newMap[msg.id] = msg;
          });
          return { messageMap: newMap };
        }),

  /**
   * Update all messages in a conversation with a new status (delivered/read).
   * Only applies to messages from other users (not the current user).
   */
  updateMessageStatus: (conversationId, status, timestamp, currentUserId) => {
    set((state) => {
      const updatedMap = { ...state.messageMap };
      const isoTimestamp = new Date(timestamp).toISOString();

      Object.values(updatedMap).forEach((msg) => {
        const isFromOtherUser = msg.senderId !== currentUserId;
        const inConversation = msg.conversationId === conversationId;

        if (!inConversation || !isFromOtherUser) return;

        if (status === "delivered" && !msg.deliveredAt) {
          updatedMap[msg.id] = { ...msg, deliveredAt: isoTimestamp };
        } else if (status === "read" && !msg.readAt) {
          updatedMap[msg.id] = { ...msg, readAt: isoTimestamp };
        }
      });

      return { messageMap: updatedMap };
    });
  },

  addOrUpdateMessage: (message) => {
    set((state) => {
      const existing = state.messageMap[message.id];
      if (existing) {
        // Shallow compare important fields to prevent useless re-renders
        if (
          existing.text === message.text &&
          existing.deliveredAt === message.deliveredAt &&
          existing.readAt === message.readAt
        ) {
          return {};
        }
      }
      return { messageMap: { ...state.messageMap, [message.id]: message } };
    });
  },
}));
