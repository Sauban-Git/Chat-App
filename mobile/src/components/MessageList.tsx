import { motion } from "framer-motion";
import { useEffect } from "react";
import { useConversationIdStore } from "../store/conversationIdStore";
import { useUserInfoStore } from "../store/userInfoStore";
import { usePresenceStore } from "../store/userPresenceStore";
import { useMessageListStore } from "../store/messagesListStore";
import axios from "../utils/axios";
import { MessageItem } from "./MessageItem";

export const MessageList = ({
  lastMessageRef,
}: {
  lastMessageRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const messageMap = useMessageListStore((state) => state.messageMap);
  const setMessageList = useMessageListStore((state) => state.setMessageList);
  const updateMessageStatus = useMessageListStore((s) => s.updateMessageStatus);

  const user = useUserInfoStore((state) => state.user);
  const typingStatus = usePresenceStore((state) => state.typingStatus);
  const conversationId = useConversationIdStore((state) => state.conversationId);
  const recipientId = useConversationIdStore((s) => s.recipientId);

  const typingUsers = typingStatus[conversationId] || {};
  const isSomeoneTyping = Object.entries(typingUsers).some(
    ([typingUserId, isTyping]) => typingUserId !== user?.id && isTyping
  );

  const getAllMessages = async () => {
    if (!conversationId) return;

    try {
      const { data } = await axios.get(`/conversations/${conversationId}/messages`);
      setMessageList(data.messages);
    } catch (error) {
      console.log("Error fetching messages: ", error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!conversationId || !user) return;

    try {
      const { data } = await axios.put("/message/read", {
        conversationId,
      });

      if (data?.readAt) {
        // update all messages in this conversation as read
        updateMessageStatus(conversationId, "read", data.readAt, user.id);
      }
    } catch (error) {
      console.log("Error marking messages as read: ", error);
    }
  };

  useEffect(() => {
    getAllMessages();
  }, []);

  useEffect(() => {
    markMessagesAsRead();
  }, []);

  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [typingStatus]);

  const sortedMessages = Object.values(messageMap).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <div className="overflow-y-auto flex-1 h-[100dvh] space-y-2">
      {sortedMessages.map((msg, index) => {
        const isRecipient = msg.senderId === recipientId;
        const isLast = index === sortedMessages.length - 1;

        return (
          <MessageItem
            key={msg.id}
            messageId={msg.id}
            isRecipient={isRecipient}
            lastMessageRef={isLast ? lastMessageRef : undefined}
          />
        );
      })}

      {/* Typing indicator */}
      {isSomeoneTyping && (
        <div className="flex justify-start">
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.3 }}
            className="inline-block bg-neutral-200 rounded-2xl py-2 px-3 text-black italic"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 h-2 bg-black rounded-full"
                  animate={{ y: [0, -3, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
