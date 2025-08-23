import { useEffect } from "react";
import { messageList } from "../local/messageList";

export const MessageList = ({
  lastMessageRef,
}: {
  lastMessageRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const messages = messageList.messages;

  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lastMessageRef]);
  
  return (
    <div className="overflow-y-auto flex-1 space-y-2">
      {messages.map((msg, index) => {
        const isSender = msg.senderId !== "user_001";
        const isLast = index === messages.length - 1;
        return isSender ? (
          <div
            key={msg.id}
            ref={isLast ? lastMessageRef : undefined}
            className="flex justify-start"
          >
            <div className="inline-block bg-neutral-200 rounded-2xl py-2 px-3 text-black">
              <div className="flex flex-col py-2">
                <p className="text-sm">{msg.content}</p>
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
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
