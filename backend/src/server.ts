import "dotenv/config";
import { createAppServer } from "./app.js";
import { logger } from "./utils/logger.js";


const { httpServer, io } = createAppServer();

export { io };

const BACKEND_PORT = process.env.BACKEND_PORT;

if (!BACKEND_PORT) {
  throw new Error("BACKEND_PORT not set in production!");
}

httpServer.listen(parseInt(BACKEND_PORT), '0.0.0.0', () => logger.info({ port: BACKEND_PORT }, "Server running"));
