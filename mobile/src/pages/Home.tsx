import { useEffect, useState } from "react";
import { Conversation } from "../components/Conversation";
import { Login } from "../components/Login";
import { Messages } from "../components/Messages";
import { Signup } from "../components/SIgnup";
import { UserInfo } from "../components/UserInfo";
import { useComponentsDisplayStore } from "../store/componentToRenderStore";
import { validateSession } from "../utils/auth";
import { useUserInfoStore } from "../store/userInfoStore";
import { LoadingScreen } from "../components/LoadingScreen";

export const Home = () => {
  const {
    conversationDisplay,
    messageDisplay,
    loginDisplay,
    signupDisplay,
    userInfoDisplay,
    setSignupDisplay,
    setConversationDisplay,
  } = useComponentsDisplayStore();
  const [loading, setLoading] = useState(false);
  const user = useUserInfoStore((state) => state.user);

  // 🔁 Control navigation based on user state
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const isValid = await validateSession();
      if (!isValid) {
        setSignupDisplay(true);
        setLoading(false)
      } else {
        // Set default component if needed
        if (
          !conversationDisplay &&
          !messageDisplay &&
          !loginDisplay &&
          !userInfoDisplay
        ) {
          setConversationDisplay(true);
        }
      }
      setLoading(false);
    };

    init();
  }, [conversationDisplay, loginDisplay, messageDisplay, setConversationDisplay, setSignupDisplay, userInfoDisplay]);

  // ✅ Block conversation if user is not present
  if (loading) return <LoadingScreen />;
  if (signupDisplay) return <Signup />;
  if (conversationDisplay && user) return <Conversation />;
  if (messageDisplay) return <Messages />;
  if (loginDisplay) return <Login />;
  if (userInfoDisplay) return <UserInfo />;

  return <div>No screen selected</div>;
};
