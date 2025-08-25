import { useUsersListStore, type User } from "../store/conversationListStore";
import { useComponentsDisplayStore } from "../store/componentToRenderStore";
import { useErrorContentStore } from "../store/errorStore";
import { useMessageListStore } from "../store/messagesListStore"; // 👈 new
import axios from "../utils/axios";
import { useEffect } from "react";
import { useConversationIdStore } from "../store/conversationIdStore";
import type { Conversation } from "../types/types";

export const ConversationList = () => {
  const { users, error } = useUsersListStore();
  const setUsers = useUsersListStore((s) => s.setUsers);

  const setMessageDisplay = useComponentsDisplayStore(
    (state) => state.setMessageDisplay
  );
  const setErrorContent = useErrorContentStore(
    (state) => state.setErrorContent
  );
  const setConversationId = useConversationIdStore((s) => s.setConversationId);
  const setReciepentId = useConversationIdStore((s) => s.setRecipientId);
  const setConversationName = useConversationIdStore(
    (s) => s.setConversationName
  );

  // 👇 subscribe to messageMap
  const messageMap = useMessageListStore((s) => s.messageMap);

  const getUsers = async () => {
    const { data } = await axios.get<{ users: User[] }>("/users/");
    setUsers(data.users);
  };

  const openMessage = async (reciepentId: string, conversationName: string) => {
    try {
      const { data } = await axios.post<{ conversation: Conversation }>(
        "/conversations/start/",
        {
          to: reciepentId,
        }
      );
      setConversationId(data.conversation.id);
      setReciepentId(reciepentId);
      setConversationName(conversationName);
      setMessageDisplay(true);
    } catch (error) {
      console.log(error);
      setErrorContent("Error while initiating conversation", true);
    }
  };

  if (error) {
    setErrorContent(error, true);
  }

  useEffect(() => {
    getUsers();
  }, []);

  // 👇 Enhance each user with latest message (from messageMap)
  const usersWithLastMessage = users.map((user) => {
    let lastMessage = user.conversation?.lastMessage;

    // if we already have messages for this conversation in store, use latest one
    const conversationMessages = Object.values(messageMap).filter(
      (msg) => msg.conversationId === user.conversation?.id
    );

    if (conversationMessages.length > 0) {
      // pick the newest by createdAt
      lastMessage = conversationMessages.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
    }

    return { ...user, conversation: { ...user.conversation, lastMessage } };
  });

  return (
    <div className="overflow-y-auto flex-1 space-y-2">
      <div className="pt-3 font-semibold">Chats</div>
      {usersWithLastMessage.map((user) => (
        <div
          key={user.id}
          onClick={() => openMessage(user.id, user.name)}
          className="flex space-x-2 space-y-2 cursor-pointer hover:bg-neutral-100 p-2 rounded-xl"
        >
          <div className="items-center flex">
            <img
              className="h-10 aspect-square object-cover rounded-full"
              src="/images/chatAvatar.svg"
              alt="avatar"
            />
          </div>
          <div className="flex flex-col py-1 w-full">
            <p className="text-md font-semibold">{user.name ?? ""}</p>
            <p className="text-xs truncate">
              {user.conversation?.lastMessage
                ? `${user.conversation.lastMessage.sender?.name ?? ""}: ${
                    user.conversation.lastMessage.text
                  }`
                : "No message yet"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
