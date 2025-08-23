
import { useComponentsDisplayStore } from "../store/componentToRenderStore";
import { ConversationList } from "./ConversationList";

export const Conversation = () => {
  const setUserInfoDisplay = useComponentsDisplayStore((state) => state.setUserInfoDisplay)
  

  return (
    <div className="rounded-xl px-4 min-h-[100dvh]">

      {/* Header */}
      <div className="sticky top-0 flex justify-between items-center bg-white">
        <div className="flex space-x-6">
          <div>
            <img
            onClick={() => setUserInfoDisplay(true)}
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

      {/* ConversationList */}
      <div>
        <ConversationList />
      </div>

    </div>
  );
};
