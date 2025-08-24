import { create } from "zustand";

interface ConversationIdStore {
  conversationId: string;
  conversationName: string;
  recipientId: string;
  setConversationId: (conversationId: string) => void;
  setRecipientId: (recipient: string) => void;
  setConversationName: (conversationName: string) => void;
}

export const useConversationIdStore = create<ConversationIdStore>((set) => ({
  conversationId: "",
  conversationName: "",
  recipientId: "",
  setConversationId: (conversationId) => set({ conversationId }),
  setRecipientId: (recipientId) => set({ recipientId }),
  setConversationName: (conversationName) => set({ conversationName }),
}));