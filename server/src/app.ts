import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { usersRouter } from "./routes/users.js";
import { authRouter } from "./routes/auth.js";
import { conversationsRouter } from "./routes/conversations.js";
import cookieParser from "cookie-parser";

dotenv.config();

export const app = express();

app.use(express.json());
app.use(
  cors({
    origin: ["http://192.168.31.55:5173"],
    credentials: true,
  })
);
app.use(cookieParser());

app.use("/auth", authRouter);
app.use("/conversations", conversationsRouter);
app.use("/users", usersRouter);
app.use("/message", usersRouter);
