import { Server as HTTPServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

export const setUpSocket = (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected");

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });
};
