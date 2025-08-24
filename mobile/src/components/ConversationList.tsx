import { useUsersListStore, type User } from "../store/conversationListStore";
import { useComponentsDisplayStore } from "../store/componentToRenderStore";
import { useErrorContentStore } from "../store/errorStore";
import axios from "../utils/axios";
import { useEffect } from "react";
import { useConversationIdStore } from "../store/conversationIdStore";
import type { Conversation } from "../types/types";

export const ConversationList = () => {
  // Get logged in userId from userInfoStore

  // Activate socket listeners with logged in userId

  const { users, error } = useUsersListStore();
  const setMessageDisplay = useComponentsDisplayStore(
    (state) => state.setMessageDisplay
  );
  const setErrorContent = useErrorContentStore(
    (state) => state.setErrorContent
  );
  const setUsers = useUsersListStore((s) => s.setUsers);
  const setConversationId = useConversationIdStore((s) => s.setConversationId);
  const setReciepentId = useConversationIdStore((s) => s.setRecipientId);
  const setConversationName = useConversationIdStore((s) => s.setConversationName);

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
      setReciepentId(reciepentId)
      setConversationName(conversationName)
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

  return (
    <div className="overflow-y-auto flex-1 space-y-2">
      <div className="pt-3 font-semibold">Chats</div>
      {users.map((user) => (
        <div
          key={user.id}
          onClick={() => openMessage(user.id, user.name)}
          className="flex space-x-2 space-y-2"
        >
          <div className="items-center flex">
            <img
              className="h-10 aspect-square object-cover rounded-full"
              src="/images/chatAvatar.svg"
              alt="avatar"
            />
          </div>
          <div className="flex flex-col py-2">
            <p className="text-md font-semibold">{user.name ?? ""}</p>
            <p className="text-xs">
              {user.conversation && user.conversation.lastMessage
                ? `${
                    user.conversation.lastMessage.sender?.name ?? ""
                  }: ${user.conversation.lastMessage.text}`
                : "No message yet"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
