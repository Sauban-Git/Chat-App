import { useEffect, useRef, useState } from "react";
import { MessageList } from "./MessageList";
import { useComponentsDisplayStore } from "../store/componentToRenderStore";
import { useConversationIdStore } from "../store/conversationIdStore";
// import { useUserInfoStore } from "../store/userInfoStore";
import axios from "../utils/axios";
import type { MessageFromApi } from "../types/types";
import { useSocketEmitters } from "../customHooks/useWebSocket";
import { usePresenceStore } from "../store/userPresenceStore";
import { useUserInfoStore } from "../store/userInfoStore";
// import { useUserInfoStore } from "../store/userInfoStore";

export const Messages = () => {
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const setConversationDisplay = useComponentsDisplayStore(
    (state) => state.setConversationDisplay
  );
  const [newMessage, setNewMessage] = useState("");
  const { conversationId, conversationName, recipientId } =
    useConversationIdStore();
  const user = useUserInfoStore((s) => s.user);

  const goBack = () => {
    setConversationDisplay(true);
  };

  const { emitMessage, emitTyping } = useSocketEmitters();


  const isOnline = usePresenceStore((state) =>
    recipientId ? state.onlineStatus[recipientId] : false
  );

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    try {
      let messagePayload;
      if (isOnline) {
        messagePayload = {
          id: "temp-id-" + Date.now(),
          conversationId: conversationId,
          text: newMessage,
          readAt: new Date().toISOString(),
          senderId: user!.id,
          createdAt: new Date().toISOString(),
          deliveredAt: new Date().toISOString(),
        };
      } else {
        messagePayload = {
          id: "temp-id-" + Date.now(),
          conversationId: conversationId,
          text: newMessage,
          senderId: user!.id,
          deliveredAt: null,
          readAt: null,
          createdAt: new Date().toISOString(),
        };
      }
      await axios.post<{ message: MessageFromApi }>(
        "/message/",
        messagePayload
      );
      console.log("SenderId: ", messagePayload.senderId);

      emitMessage(messagePayload);

      setNewMessage(""); // clear input
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };
  useEffect(() => {}, [emitMessage, isOnline, recipientId]);

  return (
    <div className="rounded-xl p-4 h-[100dvh]">
      <div className="sticky top-0 flex justify-between items-center bg-white">
        <div className="flex space-x-6">
          <div className="flex items-center">
            <button onClick={goBack}>
              <img
                className="h-8 aspect-square object-cover rounded-full"
                src="/images/back.svg"
              />
            </button>
          </div>
          <div className="flex items-center space-x-3">
            <img
              className="h-10 aspect-square object-cover rounded-full"
              src="/images/avatar.svg"
              alt="avatar"
            />
            <div className="flex flex-col">
              <span className="font-semibold">
                {conversationName || "Unknown User"}
              </span>
              <span
                className={`text-sm ${
                  isOnline ? "text-green-600" : "text-gray-500"
                }`}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-2 items-center">
          <div className="flex items-center">
            <button>
              <img className="h-8" src="/images/search.svg" alt="search" />
            </button>
          </div>
          <div className="flex items-center">
            <button>
              <img className="h-8" src="/images/menu.svg" alt="search" />
            </button>
          </div>
        </div>
      </div>
      <div>
        <MessageList lastMessageRef={lastMessageRef} />
      </div>

      {/* Input Box */}
      <div className="sticky bottom-0 inline-block w-full py-3 bg-white">
        <div className="flex justify-between items-center">
          <input
            value={newMessage}
            onFocus={() => {
              emitTyping("start", conversationId);
              setTimeout(() => {
                lastMessageRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
            onBlur={() => emitTyping("stop", conversationId)}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            type="text"
            placeholder="Type message"
            className="p-3 bg-neutral-200 rounded-xl sm:w-full"
          />
          <button onClick={handleSend}>
            <img
              className="h-12 w-12 bg-neutral-500 rounded-2xl p-2 mx-2"
              src="/images/send.svg"
            />
          </button>
        </div>
      </div>
    </div>
  );
};
