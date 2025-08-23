import { useRef, useState } from "react";
import { MessageList } from "./MessageList";
import { useComponentsDisplayStore } from "../store/componentToRenderStore";
import { useConversationIdStore } from "../store/conversationIdStore";
import { useMessageSocket } from "../customHooks/useMessageSocket";
import { useUserInfoStore } from "../store/userInfoStore";
import { usePresenceSocket } from "../customHooks/usePresenceSocket";

export const Messages = () => {
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const setConversationDisplay = useComponentsDisplayStore(
    (state) => state.setConversationDisplay
  );
  const [newMessage, setNewMessage] = useState("");
  const { sendMessage } = useMessageSocket(); // ✅ custom hook
  const conversationId = useConversationIdStore(
    (state) => state.conversationId
  );

  const user = useUserInfoStore((s) => s.user);
const { startTyping, stopTyping } = usePresenceSocket(user!.id);

  const goBack = () => {
    setConversationDisplay(true);
  };

  const handleSend = () => {
    if (!newMessage.trim()) return;

    sendMessage({ conversationId, text: newMessage }); // ✅ call socket emitter
    setNewMessage(""); // reset input
  };

  return (
    <div className="rounded-xl p-4 min-h-[100dvh]">
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
          <div>
            <img
              className="h-10 aspect-square object-cover rounded-full"
              src="/images/avatar.svg"
              alt="avatar"
            />
          </div>
          <div className="items-center flex">Chat App</div>
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
              startTyping();
              setTimeout(() => {
                lastMessageRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
            onBlur={() => stopTyping()}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            type="text"
            placeholder="Type message"
            className="p-3 bg-neutral-200 rounded-xl "
          />
          <button onClick={handleSend}>
            <img className="h-12 w-12 bg-neutral-500 rounded-2xl p-2" src="/images/send.svg"/>
          </button>
        </div>
      </div>
    </div>
  );
};
