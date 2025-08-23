import { userLists } from "../local/userLists";

export const ConversationList = () => {
  const users = userLists.users;
  return (
    <div className="overflow-y-auto flex-1 space-y-2">
      {users.map((user) => (
        <div key={user.id} className="flex space-x-2 space-y-2">
          <div className="items-center flex">
            <img
              className="h-10 aspect-square object-cover rounded-full"
              src="/images/chatAvatar.svg"
              alt="avatar"
            />
          </div>
          <div className="flex flex-col py-2">
            <p className="text-sm font-semibold">{user.name}</p>
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
