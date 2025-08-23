import { useComponentsDisplayStore } from "../store/componentToRenderStore";
import { useUserInfoStore } from "../store/userInfoStore";

export const UserInfo = () => {
  const user = useUserInfoStore((state) => state.user);
  const setConversationDisplay = useComponentsDisplayStore(
    (state) => state.setConversationDisplay
  );

  return (
    <div className="bg-indigo-200 items-center min-h-[100dvh] justify-center flex flex-col">
      {/* Header */}
      <div className="p-3 w-full space-x-6 sm:hidden">
        <div className="flex justify-between bg-white p-3 rounded-xl">
          <div className="flex items-center">
            <button onClick={() => setConversationDisplay(true)}>
              <img
                className="h-8 aspect-square object-cover rounded-full"
                src="/images/back.svg"
              />
            </button>
          </div>
          <div className="items-center flex">Chat App</div>
        </div>
      </div>

      {/* Profile Avatar and Info */}

      <div className="flex sm:hidden flex-col justify-center gap-3 m-3">
        <div className="rounded-xl shadow-2xl bg-gray-100 p-3">
          <img
            className="w-full h-auto md:w-1/2 lg:w-1/3 object-cover"
            src="/images/avatar.svg"
            alt="avatar"
          />
        </div>

        <div className="rounded-xl shadow-2xl bg-gray-100 p-3 text-2xl text-center">
          <p>Name: {user?.name}</p>
        </div>
        <div
          className="rounded-xl shadow-2xl bg-gray-100 p-5 text-xl text-center"
          text-center
        >
          <p>Email: {user?.email}</p>
        </div>
      </div>

      {/* For Desktop or bigger than mobile screen */}
      <div className="sm:flex flex-col sm:justify-center rounded-xl shadow-2xl bg-gray-100 gap-3 m-3 p-3 hidden">
        <div className="p-3 w-full space-x-6">
          <div className="flex justify-between bg-white p-3 rounded-xl">
            <div className="flex items-center">
              <button onClick={() => setConversationDisplay(true)}>
                <img
                  className="h-8 aspect-square object-cover rounded-full"
                  src="/images/back.svg"
                />
              </button>
            </div>
            <div className="items-center flex">Chat App</div>
          </div>
        </div>
        <div className="flex items-center">
          <img
            className="h-auto sm:w-1/3 object-cover"
            src="/images/avatar.svg"
            alt="avatar"
          />
          <div className="w-2/3">
            <div className="rounded-xl bg-gray-100 p-5 text-2xl ">
              <p>Name: {user?.name}</p>
            </div>
            <div className="rounded-xl bg-gray-100 p-5 text-2xl" text-center>
              <p>Email: {user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
