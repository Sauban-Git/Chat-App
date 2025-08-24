import { create } from "zustand";
import type { MessageFromApi } from "../types/types";

interface MessageListState {
  messageList: MessageFromApi[];
  setMessageList: (
    value: MessageFromApi[] | ((prev: MessageFromApi[]) => MessageFromApi[])
  ) => void;
  updateMessageReadAt: (conversationId: string, readAtTimestamp: string) => void;
}

export const useMessageListStore = create<MessageListState>((set, get) => ({
  messageList: [],
  
  setMessageList: (value) =>
    typeof value === "function"
      ? set({ messageList: value(get().messageList) })
      : set({ messageList: value }),
  
  updateMessageReadAt: (conversationId, readAtTimestamp) => {
    set((state) => {
      const updatedMessages = state.messageList.map((msg) => {
        if (msg.conversationId === conversationId && !msg.readAt) {
          return {
            ...msg,
            readAt: new Date(readAtTimestamp).toISOString(),
          };
        }
        return msg;
      });
      return { messageList: updatedMessages };
    });
  },
}));
