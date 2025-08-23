import { create } from "zustand";

interface ComponentsDisplayState {
  messageDisplay: boolean;
  loginDisplay: boolean;
  conversationDisplay: boolean;
  signupDisplay: boolean;
  userInfoDisplay: boolean;

  setMessageDisplay: (value: boolean) => void;
  setLoginDisplay: (value: boolean) => void;
  setConversationDisplay: (value: boolean) => void;
  setSignupDisplay: (value: boolean) => void;
  setUserInfoDisplay: (value: boolean) => void;
}

export const useComponentsDisplayStore = create<ComponentsDisplayState>((set) => ({
  messageDisplay: false,
  loginDisplay: false,
  conversationDisplay: false,
  signupDisplay: false,
  userInfoDisplay: false,

  setMessageDisplay: (value: boolean) =>
    set({
      messageDisplay: value,
      loginDisplay: !value,
      conversationDisplay: !value,
      signupDisplay: !value,
      userInfoDisplay: !value,
    }),
  setLoginDisplay: (value: boolean) =>
    set({
      messageDisplay: !value,
      loginDisplay: value,
      conversationDisplay: !value,
      signupDisplay: !value,
      userInfoDisplay: !value,
    }),
  setConversationDisplay: (value: boolean) =>
    set({
      messageDisplay: !value,
      loginDisplay: !value,
      conversationDisplay: value,
      signupDisplay: !value,
      userInfoDisplay: !value,
    }),
  setSignupDisplay: (value: boolean) =>
    set({
      messageDisplay: !value,
      loginDisplay: !value,
      conversationDisplay: !value,
      signupDisplay: value,
      userInfoDisplay: !value,
    }),
  setUserInfoDisplay: (value: boolean) =>
    set({
      messageDisplay: !value,
      loginDisplay: !value,
      conversationDisplay: !value,
      signupDisplay: !value,
      userInfoDisplay: value,
    }),
}));
