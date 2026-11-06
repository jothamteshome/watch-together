import dotenv from 'dotenv';
import { createAppServer } from "./app.js";


dotenv.config();

const { httpServer, io } = createAppServer();

export { io };

const BACKEND_PORT = process.env.BACKEND_PORT;

if (!BACKEND_PORT) {
  throw new Error("BACKEND_PORT not set in production!");
}

httpServer.listen(parseInt(BACKEND_PORT), '0.0.0.0', () => console.log(`Server running on port ${BACKEND_PORT}`));
