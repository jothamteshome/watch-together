import cors from 'cors';
import express from "express";
import { readFileSync } from 'fs';
import { createServer } from "http";
import { Server } from "socket.io";
import roomRoutes from "./routes/roomRoutes.js";
import videoApiRoutes from "./routes/videoApiRoutes.js"
import { registerChatEventHandlers } from './sockets/chatEventHandlers.js';
import registerConnectionEventHandlers from './sockets/connectionEventHandlers.js';
import { registerPlaylistEventHandlers } from './sockets/playlistEventHandlers.js';
import { registerVideoEventHandlers } from './sockets/videoEventHandlers.js';
import getFormattedDate from "./utils/date.js";


const { version: backendVersion } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
);


/** Builds the express app, HTTP server and Socket.IO server without listening */
export function createAppServer() {
  const app = express();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    path: "/v1/socket-io",
    cors: { origin: "*" }
  });

  app.use(cors());

  // Middleware
  app.use(express.json());

  // Routes
  app.use("/v1/rooms", roomRoutes);
  app.use("/v1/video-api", videoApiRoutes)
  app.get('/health', (req, res) => {
    console.log(`[${getFormattedDate()}] health check - OK`);
    res.status(200).send("OK");
  });
  app.get('/version', (_req, res) => {
    res.json({ version: backendVersion });
  });


  // Socket.IO events
  io.on("connection", (socket) => {
    registerConnectionEventHandlers(io, socket);
    registerVideoEventHandlers(io, socket);
    registerPlaylistEventHandlers(io, socket);
    registerChatEventHandlers(io, socket);
  });

  return { httpServer, io };
}
