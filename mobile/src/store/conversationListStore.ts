import { create } from "zustand";
import axios from "../utils/axios";
import type { AxiosError } from "axios";

interface User {
  id: string;
  name: string;
  email: string;
  conversation: {
    id: string;
    lastMessage: {
      id: string;
      content: string;
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
  loading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  clearUsers: () => void;
}

export const useUsersListStore = create<UsersListStore>((set) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get("/users/");
      set({ users: response.data.users, loading: false });
    } catch (error) {
        const err = error as AxiosError<{ error: string }>;
      set({
        error: err?.response?.data?.error || "Failed to fetch users",
        loading: false,
      });
    }
  },

  clearUsers: () => set({ users: [], error: null }),
}));
