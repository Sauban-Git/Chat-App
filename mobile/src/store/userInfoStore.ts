import { create } from "zustand";
import type { UserInfoApi } from "../types/types";
import { persist } from "zustand/middleware";

interface UserInfoStore {
  user: UserInfoApi | null;
  setUser: (user: UserInfoApi | null) => void;
  clearUser: () => void;
}

export const useUserInfoStore = create<UserInfoStore>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: 'user-info', 
    }
  )
);