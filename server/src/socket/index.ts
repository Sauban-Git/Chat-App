import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { authenticateSocket } from "./middleware/authenticateSocket.js";
import { handleConnection } from "./handlers/connectionHandler.js";


export const setUpSocket = (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    handleConnection(socket, io);
  });

  console.log("⚡ Socket.IO server initialized");
};
