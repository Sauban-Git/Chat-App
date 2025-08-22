import express from "express"
import dotenv from "dotenv"
import cors from "cors"
dotenv.config()

export const app = express()

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json())