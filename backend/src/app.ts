import cors from 'cors';
import express from "express";
import { readFileSync } from 'fs';
import { createServer } from "http";
import { Server } from "socket.io";
import roomRoutes from "./routes/roomRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import videoApiRoutes from "./routes/videoApiRoutes.js"
import { registerChatEventHandlers } from './sockets/chatEventHandlers.js';
import registerConnectionEventHandlers from './sockets/connectionEventHandlers.js';
import { registerPlaylistEventHandlers } from './sockets/playlistEventHandlers.js';
import { registerUserEventHandlers } from './sockets/userEventHandlers.js';
import { registerVideoEventHandlers } from './sockets/videoEventHandlers.js';
import { logger } from "./utils/logger.js";


const { version: backendVersion } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
);


/** Builds the express app, HTTP server and Socket.IO server without listening */
export function createAppServer() {
  const app = express();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    path: "/v1/socket-io",
    cors: { origin: "*" },
    // Socket.IO closes the connection of a client that sends a bigger packet. The largest real one
    // is a chat message of 1000 characters, and a profile on room:join, so this bounds every field.
    maxHttpBufferSize: 64 * 1024
  });

  app.use(cors());

  // Middleware
  app.use(express.json());

  // Routes
  app.use("/v1/rooms", roomRoutes);
  app.use("/v1/users", userRoutes);
  app.use("/v1/video-api", videoApiRoutes)
  // The frontend polls this every few seconds to measure latency, so it is deliberately not logged
  app.get('/health', (req, res) => {
    res.status(200).send("OK");
  });
  app.get('/version', (_req, res) => {
    res.json({ version: backendVersion });
  });


  // Socket.IO events
  io.on("connection", (socket) => {
    // Every client event carries an object; drop anything else before a handler destructures it
    socket.use(([event, payload], next) => {
      if (typeof payload === "object" && payload !== null) next();
      else logger.warn({ socketId: socket.id, event: String(event).slice(0, 64) }, "Dropped event with a non-object payload");
    });

    registerConnectionEventHandlers(io, socket);
    registerVideoEventHandlers(io, socket);
    registerPlaylistEventHandlers(io, socket);
    registerChatEventHandlers(io, socket);
    registerUserEventHandlers(io, socket);
  });

  return { httpServer, io };
}
