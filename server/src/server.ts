import { createServer } from "http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { setupSocket } from "./socket/socket.js";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ["http://192.168.31.55:5173"], credentials: true },
});

setupSocket(io);

httpServer.listen(3000, () => {
  console.log("Server is running on port 3000");
});
