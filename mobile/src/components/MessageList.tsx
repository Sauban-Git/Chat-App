import { useEffect } from "react";
import { useConversationIdStore } from "../store/conversationIdStore";
import { useUserInfoStore } from "../store/userInfoStore";
import { usePresenceStore } from "../store/userPresenceStore";
import { useMessageListStore } from "../store/messagesListStore";
import axios from "../utils/axios";
import type { MessageFromApi } from "../types/types";

export const MessageList = ({
  lastMessageRef,
}: {
  lastMessageRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const messages = useMessageListStore((state) => state.messageList);
  const setMessageList = useMessageListStore((state) => state.setMessageList);
  const user = useUserInfoStore((state) => state.user);


  const typingStatus = usePresenceStore((state) => state.typingStatus);
  const conversationId = useConversationIdStore((state) => state.conversationId);

  // typingUsers is an object like { userId: true/false, ... }
  const typingUsers = typingStatus[conversationId] || {};

  // Check if anyone except the current user is typing
  const isSomeoneTyping = Object.entries(typingUsers).some(
    ([typingUserId, isTyping]) => typingUserId !== user!.id && isTyping
  );

  const getAllMessages = async () => {
  if (!conversationId) return;  // exit early if no conversationId yet

  try {
    const { data } = await axios.get<{ messages: MessageFromApi[] }>(
      `/conversations/${conversationId}/messages`
    );
    setMessageList(data.messages);
  } catch (error) {
    console.log("Error: ", error);
  }
};


  useEffect(() => {
    getAllMessages();
  }, [conversationId])

  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [typingStatus, messages]); // scroll when messages or typing changes

  return (
    <div className="overflow-y-auto flex-1 space-y-2">
      {messages.map((msg, index) => {
        const isSender = msg.senderId !== user!.id; // corrected sender check
        const isLast = index === messages.length - 1;
        return isSender ? (
          <div
            key={msg.id}
            ref={isLast ? lastMessageRef : undefined}
            className="flex justify-start"
          >
            <div className="inline-block bg-neutral-200 rounded-2xl py-2 px-3 text-black">
              <div className="flex flex-col py-2">
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          </div>
        ) : (
          <div
            key={msg.id}
            ref={isLast ? lastMessageRef : undefined}
            className="flex justify-end"
          >
            <div className="inline-block bg-neutral-500 rounded-2xl py-2 px-3 text-white">
              <div className="flex flex-col py-2">
                <p className="text-sm">{msg.text}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Typing indicator div, rendered only if someone else is typing */}
      {isSomeoneTyping && (
        <div className="flex justify-start">
          <div className="inline-block bg-neutral-200 rounded-2xl py-2 px-3 text-black italic">
            <p className="text-sm">typing...</p>
          </div>
        </div>
      )}
    </div>
  );
};
