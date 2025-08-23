import { useUserInfoStore } from "../store/userInfoStore";
import axios from "./axios";

export const validateSession = async () => {
    
    try {
        await axios.get("/users/")
        return true;
    } catch {
        useUserInfoStore.getState().setUser(null)
        return false;
    }
}