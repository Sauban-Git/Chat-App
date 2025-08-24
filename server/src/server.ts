import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { setupSocket } from './socket/socket.js';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

setupSocket(io);

httpServer.listen(3000, () => {
  console.log('Server is running on port 3000');
});
