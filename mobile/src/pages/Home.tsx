import { useEffect, useState } from "react";
import { Conversation } from "../components/Conversation";
import { Login } from "../components/Login";
import { Messages } from "../components/Messages";
import { Signup } from "../components/SIgnup";
import { UserInfo } from "../components/UserInfo";
import { useComponentsDisplayStore } from "../store/componentToRenderStore";
import { useUserInfoStore } from "../store/userInfoStore";
import { LoadingScreen } from "../components/LoadingScreen";
import axios from "../utils/axios"
import type { UserInfoApi } from "../types/types";

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
  const {setUser, user} = useUserInfoStore();

  // 🔁 Control navigation based on user state
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try{
        const {data}  = await axios.get<{user: UserInfoApi}>("/auth/info")
        setUser(data.user)
        setLoading(false)
        setConversationDisplay(true)
      }catch {
        console.log("User not logged in")
        setLoading(false)
        setSignupDisplay(true)
      }finally {
        setLoading(false)
      }
    }
    init();
  }, []);

  // ✅ Block conversation if user is not present
  if (loading) return <LoadingScreen />;
  if (signupDisplay) return <Signup />;
  if (conversationDisplay && user) return <Conversation />;
  if (messageDisplay) return <Messages />;
  if (loginDisplay) return <Login />;
  if (userInfoDisplay) return <UserInfo />;

  return <Signup/>;
};
