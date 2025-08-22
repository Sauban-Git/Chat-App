import express from "express"
import dotenv from "dotenv"
import { messageRouter } from "./routes/messages.js"
import cors from "cors"
dotenv.config()

export const app = express()
app.use("/messages",messageRouter)

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json())