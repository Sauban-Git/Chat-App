import { useUsersListStore, type User } from "../store/conversationListStore";
import { useComponentsDisplayStore } from "../store/componentToRenderStore";
import { useErrorContentStore } from "../store/errorStore";
import { useConversationSocket } from "../customHooks/useConversationSocket";
import { useUserInfoStore } from "../store/userInfoStore"; // import your user info store
import axios from "../utils/axios";
import { useEffect } from "react";
import { useConversationIdStore } from "../store/conversationIdStore";

export const ConversationList = () => {
  // Get logged in userId from userInfoStore
  const userId = useUserInfoStore((state) => state.user!.id);

  // Activate socket listeners with logged in userId
  const {initiateConversation} = useConversationSocket(userId);

  const { users, error } = useUsersListStore();
  const setMessageDisplay = useComponentsDisplayStore(
    (state) => state.setMessageDisplay
  );
  const setErrorContent = useErrorContentStore(
    (state) => state.setErrorContent
  );
  const setUsers = useUsersListStore((s) => s.setUsers);
  const setConversationId = useConversationIdStore((s) => s.setConversationId)

  const getUsers = async () => {
    const { data } = await axios.get<{ users: User[] }>("/users/");
    setUsers(data.users);
  };

  const openMessage = (reciepentId: string) => {
    initiateConversation(reciepentId, (conversationId) => {
      setConversationId(conversationId)
    })
    setMessageDisplay(true)
  }

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
          onClick={() => openMessage(user.id)}
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
            <p className="text-md font-semibold">{user.name}</p>
            <p className="text-xs">
              {user.conversation
                ? `${user.conversation.lastMessage?.sender.name}: ${user.conversation.lastMessage?.text}`
                : "No message yet"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
