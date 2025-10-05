import cors from 'cors';
import dotenv from 'dotenv';
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import roomRoutes from "./routes/roomRoutes.js";
import youtubeApiRoutes from "./routes/youtubeApiRoutes.js"
import { registerChatEventHandlers } from './sockets/chatEventHandlers.js';
import registerConnectionEventHandlers from './sockets/connectionEventHandlers.js';
import { registerPlaylistEventHandlers } from './sockets/playlistEventHandlers.js';
import { registerVideoEventHandlers } from './sockets/videoEventHandlers.js';
import getFormattedDate from "./utils/date.js";


dotenv.config();

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, { 
  path: "/v1/socket-io",
  cors: { origin: "*" } 
});

app.use(cors());

// Middleware
app.use(express.json());

// Routes
app.use("/v1/rooms", roomRoutes);
app.use("/v1/youtube-api", youtubeApiRoutes)
app.get('/health', (req, res) => {
  console.log(`[${getFormattedDate()}] health check - OK`);
  res.status(200).send("OK");
});


// Socket.IO events
io.on("connection", (socket) => { 
  registerConnectionEventHandlers(io, socket);
  registerVideoEventHandlers(io, socket);
  registerPlaylistEventHandlers(io, socket);
  registerChatEventHandlers(io, socket);
});

const BACKEND_PORT = process.env.BACKEND_PORT;

if (!BACKEND_PORT) {
  throw new Error("BACKEND_PORT not set in production!");
}

httpServer.listen(parseInt(BACKEND_PORT), '127.0.0.1', () => console.log(`Server running on port ${BACKEND_PORT}`));