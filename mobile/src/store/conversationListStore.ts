// src/store/conversationListStore.ts
import { create } from "zustand";

export interface User {
  id: string;
  name: string;
  email: string;
  presence?: "online" | "offline"; // optional presence flag at user level
  conversation: {
    id: string;
    lastMessage: {
      id: string;
      text: string;
      createdAt: string;
      sender: {
        id: string;
        name: string;
        email: string;
      };
    } | null;
  } | null;
}

interface UsersListStore {
  users: User[];
  error: string | null;

  setUsers: (users: User[]) => void;
  updateLastMessage: (
    conversationId: string,
    newLastMessage: NonNullable<User["conversation"]>["lastMessage"]
  ) => void;
  updateUserPresence: (userId: string, isOnline: boolean) => void;
  clearUsers: () => void;
}

export const useUsersListStore = create<UsersListStore>((set) => ({
  users: [],
  error: null,

  setUsers: (users) => set({ users }),

  updateLastMessage: (conversationId, newLastMessage) =>
    set((state) => ({
      users: state.users.map((user) =>
        user.conversation?.id === conversationId
          ? {
              ...user,
              conversation: {
                ...user.conversation,
                lastMessage: newLastMessage,
              },
            }
          : user
      ),
    })),

  updateUserPresence: (userId, isOnline) =>
    set((state) => ({
      users: state.users.map((user) =>
        user.id === userId
          ? {
              ...user,
              presence: isOnline ? "online" : "offline",
            }
          : user
      ),
    })),

  clearUsers: () => set({ users: [], error: null }),
}));
