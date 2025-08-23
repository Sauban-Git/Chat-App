
import axios from "axios";

const instance = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL, // optional default API base
  withCredentials: true,           // ✅ cookies will be sent
});

export default instance;