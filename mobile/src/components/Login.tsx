import { useRef, useState } from "react";
import axios from "../utils/axios";
import { motion } from "framer-motion";
import { useUserInfoStore } from "../store/userInfoStore";
import { useComponentsDisplayStore } from "../store/componentToRenderStore";
import type { UserInfoApi } from "../types/types";
import type { AxiosError } from "axios";
import { useErrorContentStore } from "../store/errorStore";

export const Login = () => {
  const [loading, setloading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const setUser = useUserInfoStore((state) => state.setUser);
  const setConversationDisplay = useComponentsDisplayStore(
    (state) => state.setConversationDisplay
  );
  const setSignupDisplay = useComponentsDisplayStore(
    (state) => state.setSignupDisplay
  );
  const setErrorContent = useErrorContentStore((state) => state.setErrorContent)

  const submit = async () => {
    setloading(true);
    const email = emailRef.current?.value;
    if (!email) return setloading(false);
    try {
      const { data } = await axios.post<{ user: UserInfoApi }>("/auth/login", {
        email,
      });

      setUser(data.user);
      setConversationDisplay(true);
    } catch (error) {
      const err = error as AxiosError<{ error: string }>;
      setErrorContent(err?.response?.data?.error ?? null, true)
      console.error("Error while axios fetching", error);
    } finally {
      setloading(false);
    }
  };

  return (
    <div>
      <motion.div
        className="flex justify-center items-center min-h-[100dvh] bg-gradient-to-br from-blue-50 to-blue-200"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl">
          <h2 className="text-2xl font-bold text-center mb-6 text-[#25D350]">
            Sign In
          </h2>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="abcdef@xyz.com"
              ref={emailRef}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D350]"
            />

            <button
              disabled={loading}
              onClick={submit}
              className={`w-full py-2 font-semibold rounded-lg transition ${
                loading
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-[#25D350] hover:bg-[#25D366] text-white"
              }`}
            >
              {loading ? "Logging in..." : "Login to your account"}
            </button>
            <div className="p-3 m-3 text-center text-gray-500 ">
              Need an account?{" "}
              <button
                className="text-blue-500 underline"
                onClick={() => setSignupDisplay(true)}
              >
                Signup
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
