import { useEffect } from "react";
import { userLists } from "../local/userLists";
import { useUsersListStore } from "../store/conversationListStore";

export const ConversationList = () => {
  // const { users, loading, error, fetchUsers } = useUsersListStore();

  // useEffect(() => {
  //   fetchUsers();
  // }, []);

  // if (loading) return <div>Loading users...</div>;
  // if (error) return <div>Error: {error}</div>;
  const usersDemo = userLists.users;
  return (
    <div className="overflow-y-auto flex-1 space-y-2">
      {usersDemo.map((user) => (
        <div key={user.id} className="flex space-x-2 space-y-2">
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
              {user.conversation?.lastMessage.sender.name}:{" "}
              {user.conversation?.lastMessage.content}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
