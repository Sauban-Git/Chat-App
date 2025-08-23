import { useUserInfoStore } from "../store/userInfoStore";
import type { UserInfoApi } from "../types/types";
import axios from "./axios";

export const validateSession = async () => {
    
    try {
        const {data} = await axios.get<{user: UserInfoApi}>("/auth/info")
        useUserInfoStore.getState().setUser(data.user)
        return true;
    } catch {
        useUserInfoStore.getState().clearUser()
        return false;
    }
}