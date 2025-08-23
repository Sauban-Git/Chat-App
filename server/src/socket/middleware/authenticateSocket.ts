import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { COOKIE_NAME, JWT_SECRET } from "../../config/jwt.js";
import type { AuthenticatedSocket } from "../types.js";

export const authenticateSocket = (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    const cookiesHeader = socket.handshake.headers.cookie;

    if (!cookiesHeader) {
      return next(new Error("No cookies provided in headers"));
    }

    const cookies = Object.fromEntries(
      cookiesHeader.split(";").map((cookie) => {
        const [key, value] = cookie.trim().split("=");
        return [key, decodeURIComponent(value?? "")];
      })
    );

    const token = cookies[COOKIE_NAME];

    if (!token) {
      return next(new Error("Authentication token not found in cookies"));
    }

    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    if (!payload.userId) {
      return next(new Error("Invalid JWT payload: userId missing"));
    }

    (socket as AuthenticatedSocket).data = {
      userId: payload.userId,
    };

    next();
  } catch (err: any) {
    console.error("❌ Socket authentication error:", err.message);
    next(new Error("Authentication error: " + err.message));
  }
};
