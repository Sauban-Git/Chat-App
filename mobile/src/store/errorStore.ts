import { create } from "zustand";

interface ErrorContent {
    errorContent: string | null;
    isErrorContent: boolean;
    setErrorContent: (errorContent: string | null, isErrorContent: boolean) => void;
}

export const useErrorContentStore = create<ErrorContent>((set) => ({
  errorContent: null,
  isErrorContent: false,
  setErrorContent: (errorContent, isErrorContent) => set({ errorContent, isErrorContent }),
}));