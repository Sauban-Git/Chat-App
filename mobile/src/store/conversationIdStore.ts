import { create } from "zustand";

interface ConversationIdStore {
  conversationId: string;
  conversationName: string;
  setConversationId: (conversationId: string) => void;
  setConversationName: (conversationName: string) => void;
}

export const useConversationIdStore = create<ConversationIdStore>((set) => ({
  conversationId: "",
  conversationName: "",
  setConversationId: (conversationId) => set({ conversationId }),
  setConversationName: (conversationName) => set({ conversationName }),
}));