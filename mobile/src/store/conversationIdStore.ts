import { create } from "zustand";

interface ConversationIdStore {
  conversationId: string;
  setConversationId: (conversationId: string) => void;
}

export const useConversationIdStore = create<ConversationIdStore>((set) => ({
  conversationId: "",
  setConversationId: (conversationId) => set({ conversationId }),
}));