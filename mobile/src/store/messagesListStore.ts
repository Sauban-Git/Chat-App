import { create } from "zustand";
import type { MessageFromApi } from "../types/types";


interface MessageListState {
  messageList: MessageFromApi[];
  setMessageList: (
    value: MessageFromApi[] | ((prev: MessageFromApi[]) => MessageFromApi[])
  ) => void;
}

export const useMessageListStore = create<MessageListState>((set, get) => ({
  messageList: [],
  setMessageList: (value) =>
    typeof value === "function"
      ? set({ messageList: value(get().messageList) })
      : set({ messageList: value }),
}));