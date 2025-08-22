import { app } from "./server.js"
import { createServer } from "node:http"
import { setUpSocket } from "./webSocket.js"

const port = Number(process.env.PORT) || 3000

const server = createServer(app)

setUpSocket(server)

server.listen(port, '0.0.0.0', () => {
    console.log(`App running on port ${port}`)
})

server.on("error", (err) => {
  console.error("Server error:", err);
});
