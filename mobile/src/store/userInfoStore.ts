import { create } from "zustand";
import type { UserInfoApi } from "../types/types";

interface UserInfoStore {
  user: UserInfoApi | null;
  setUser: (user: UserInfoApi | null) => void;
  clearUser: () => void;
}

export const useUserInfoStore = create<UserInfoStore>()(
  
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
  
);