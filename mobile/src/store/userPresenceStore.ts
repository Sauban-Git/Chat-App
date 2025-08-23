import { create } from "zustand";

interface PresenceState {
  // online status by userId
  onlineStatus: Record<string, boolean>;
  // typing status by conversationId and userId
  typingStatus: Record<string, Record<string, boolean>>;
  setOnlineStatus: (userId: string, isOnline: boolean) => void;
  setTypingStatus: (conversationId: string, userId: string, isTyping: boolean) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineStatus: {},
  typingStatus: {},
  setOnlineStatus: (userId, isOnline) =>
    set((state) => ({
      onlineStatus: { ...state.onlineStatus, [userId]: isOnline },
    })),
  setTypingStatus: (conversationId, userId, isTyping) =>
    set((state) => {
      const currentTyping = state.typingStatus[conversationId] || {};
      return {
        typingStatus: {
          ...state.typingStatus,
          [conversationId]: { ...currentTyping, [userId]: isTyping },
        },
      };
    }),
}));
