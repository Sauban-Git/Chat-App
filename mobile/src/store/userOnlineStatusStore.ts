import { create } from "zustand";

interface OnlineStatusStore {
  usersStatus: {
    [userId: string]: boolean;
  };
  setUserStatus: (statusMap: { [userId: string]: boolean }) => void;
}

const useUserOnlineStatusStore = create<OnlineStatusStore>((set) => ({
  usersStatus: {},
  setUserStatus: (statusMap) =>
    set((state) => ({
      usersStatus: { ...state.usersStatus, ...statusMap },
    })),
}));

export default useUserOnlineStatusStore;
