import type { Server, Socket } from "socket.io";
import { handlePlaylistJoinRoomSync } from "./playlistEventHandlers.js";
import { handleVideoJoinRoomSync } from "./videoEventHandlers.js";
import { roomManager } from "../models/RoomManager.js";


/**
 * Handle room join events from socket.IO
 * @param socket The current socket
 * @param roomId The current roomId to handle join events for
 */
function joinRoom(socket: Socket, roomId: string) {
  // Initialize roomUsers set if missing
  if (!roomManager.roomUsers[roomId]) { 
    roomManager.roomUsers[roomId] = new Set(); 
  };
  roomManager.roomUsers[roomId].add(socket.id);

  // Join the room
  socket.join(roomId);

  // Log user joining room
  console.log(`${socket.id} joined room ${roomId}`);

  handleVideoJoinRoomSync(socket, roomId);
  handlePlaylistJoinRoomSync(socket, roomId);
}


function leaveRoom(socket: Socket, roomId: string) {
  socket.leave(roomId);
  console.log(`${socket.id} left room ${roomId}`);

    // Remove user from room users
    disconnectCleanup(socket, roomId, roomManager.roomUsers[roomId]);
}


/**
 * Handle disconnection events from socket.IO
 * @param socket The current socket being disconnected from
 */
function disconnect(socket: Socket) {
  console.log("User disconnected:", socket.id);

  // Run cleanup function for each room in socket
  for (const [roomId, userSet] of Object.entries(roomManager.roomUsers)) {
    disconnectCleanup(socket, roomId, userSet);
  }
}


/**
 * Helper function to cleanup unused rooms from in-memory store
 * @param socket The current socket being disconnected from
 * @param roomId The current roomId to remove the socket from
 */
function disconnectCleanup(socket: Socket, roomId: string, userSet?: Set<string>) {
  // Get set of users in room
  const currentRoomUsers = userSet;

  // If room doesn't exist, return
  if (!currentRoomUsers) return;

  // If socket id exists in room users, remove from rooms users
  if (currentRoomUsers.has(socket.id)) {
    console.log(`Deleting user ${socket.id} from users`);
    currentRoomUsers.delete(socket.id);
  }

  // If users list for room is empty, delete room entirely
  if (currentRoomUsers.size === 0) {
    delete roomManager.roomUsers[roomId];
    setTimeout(() => { 
      roomManager.videoStates.delete(roomId);
      console.log(`Room ${roomId} deleted because it is empty`);
    }, 1000 * 60 * 60); // 1 hour timeout before deleting room
  }
}


export default function registerConnectionEventHandlers(io: Server, socket: Socket) {
  console.log("New client connected:", socket.id);

  // Join room
  socket.on("room:join", ({ roomId }: { roomId: string }) => joinRoom(socket, roomId));

  // Leave room
  socket.on("room:leave", ({ roomId }: { roomId: string }) => leaveRoom(socket, roomId));

  // Disconnect
  socket.on("disconnect", () => disconnect(socket));
}