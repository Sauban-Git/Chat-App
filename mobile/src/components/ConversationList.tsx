import { useEffect } from "react";
import { useUsersListStore } from "../store/conversationListStore";
import { Error } from "./Error";
import { useComponentsDisplayStore } from "../store/componentToRenderStore";

export const ConversationList = () => {
  const { users, loading, error, fetchUsers } = useUsersListStore();
  const setMessageDisplay = useComponentsDisplayStore((state) => state.setMessageDisplay)

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (loading) return <div>Loading users...</div>;
  if (error) return <div><Error error={error}/></div>;
  return (
    <div className="overflow-y-auto flex-1 space-y-2">
      {users.map((user) => (
        <div key={user.id} onClick={() => setMessageDisplay(true)} className="flex space-x-2 space-y-2">
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
              { (user.conversation)?
              `${user.conversation?.lastMessage?.sender.name}:{" "}
              ${user.conversation?.lastMessage?.content} ` : "No message yet"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
