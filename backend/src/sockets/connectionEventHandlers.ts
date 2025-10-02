import type { Server, Socket } from "socket.io";
import { handleChatJoinRoom, handleChatLeaveRoom, handleChatDisconnect } from "./chatEventHandlers.js";
import { handlePlaylistJoinRoomSync } from "./playlistEventHandlers.js";
import { handleVideoJoinRoomSync } from "./videoEventHandlers.js";
import { serverManager } from "../models/RoomManager.js";
import generateUser from "../utils/generateUser.js";
import type RoomState from "../interfaces/RoomState.js";


/**
 * Handle room join events from socket.IO
 * @param socket The current socket
 * @param roomId The current roomId to handle join events for
 */
function joinRoom(io: Server, socket: Socket, roomId: string) {
  const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
  if (!roomState) return;

  roomState.addUser(socket.id);

  serverManager.serverRooms.set(roomId, roomState);
  serverManager.serverUsers.set(socket.id, generateUser(socket.id));

  // Join the room
  socket.join(roomId);

  // Log user joining room
  console.log(`${socket.id} joined room ${roomId}`);

  handleVideoJoinRoomSync(socket, roomId);
  handlePlaylistJoinRoomSync(socket, roomId);
  handleChatJoinRoom(io, socket, roomId);
}


function leaveRoom(io: Server, socket: Socket, roomId: string) {
  socket.leave(roomId);
  console.log(`${socket.id} left room ${roomId}`);

  handleChatLeaveRoom(io, socket, roomId);

  // Remove user from room users
  disconnectCleanup(socket, roomId, serverManager.serverRooms.get(roomId));
}


/**
 * Handle disconnection events from socket.IO
 * @param socket The current socket being disconnected from
 */
function disconnect(io: Server, socket: Socket) {
  console.log("User disconnected:", socket.id);

  // Run cleanup function for each room in socket
  for (const roomId of Object.keys(serverManager.serverRooms)) {
    handleChatDisconnect(io, socket, roomId);
    disconnectCleanup(socket, roomId, serverManager.serverRooms.get(roomId));
  }
}


/**
 * Helper function to cleanup unused rooms from in-memory store
 * @param socket The current socket being disconnected from
 * @param roomId The current roomId to remove the socket from
 */
function disconnectCleanup(socket: Socket, roomId: string, roomState?: RoomState) {
  if (!roomState) return;

  // Get set of users in room
  const users: Set<string> = roomState.getUsers();

  // If socket id exists in room users, remove from rooms users
  if (users.has(socket.id)) {
    console.log(`Deleting user ${socket.id} from users`);
    users.delete(socket.id);
    serverManager.serverUsers.delete(socket.id);
  }

  // If users list for room is empty, delete room entirely
  if (users.size === 0) {
    setTimeout(() => {
      serverManager.serverRooms.delete(roomId);
      console.log(`Room ${roomId} deleted because it is empty`);
    }, 1000 * 60 * 60); // 1 hour timeout before deleting room
  }
}


export default function registerConnectionEventHandlers(io: Server, socket: Socket) {
  console.log("New client connected:", socket.id);

  // Join room
  socket.on("room:join", ({ roomId }: { roomId: string }) => joinRoom(io, socket, roomId));

  // Leave room
  socket.on("room:leave", ({ roomId }: { roomId: string }) => leaveRoom(io, socket, roomId));

  // Disconnect
  socket.on("disconnect", () => disconnect(io, socket));
}