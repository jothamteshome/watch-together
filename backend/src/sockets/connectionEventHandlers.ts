import type { Server, Socket } from "socket.io";
import { handleChatJoinRoom, handleChatLeaveRoom, handleChatDisconnect } from "./chatEventHandlers.js";
import { handlePlaylistJoinRoomSync } from "./playlistEventHandlers.js";
import { handleVideoJoinRoomSync } from "./videoEventHandlers.js";
import { serverManager } from "../models/RoomManager.js";
import type RoomState from "../models/RoomState.js";
import type { RoomJoinEvent } from "@shared/interfaces/RoomEvents";
import type User from "@shared/interfaces/User";

const ROOM_EMPTY_DELETE_DELAY_MS = 1000 * 60 * 60; // 1 hour


/**
 * Handle room join events from socket.IO
 * @param socket The current socket
 * @param roomId The current roomId to handle join events for
 */
function joinRoom(io: Server, socket: Socket, roomId: string, user: User) {
  const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
  if (!roomState) return;

  roomState.addUser(socket.id);
  socket.data.roomId = roomId;

  serverManager.serverRooms.set(roomId, roomState);
  serverManager.registerConnection(socket.id, user);

  // Join the room
  socket.join(roomId);

  // Log user joining room
  console.log(`${socket.id} joined room ${roomId} as user ${user.id} (${user.username})`);

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
  delete socket.data.roomId;
}


/**
 * Handle disconnection events from socket.IO
 * @param socket The current socket being disconnected from
 */
function disconnect(io: Server, socket: Socket) {
  console.log("User disconnected:", socket.id);

  const roomId: string | undefined = socket.data.roomId;
  if (!roomId) return;

  handleChatDisconnect(io, socket, roomId);
  disconnectCleanup(socket, roomId, serverManager.serverRooms.get(roomId));
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
    console.log(`Removing socket ${socket.id} from room users`);
    users.delete(socket.id);
    serverManager.disconnectSocket(socket.id);
  }

  // If users list for room is empty, schedule the room for deletion. addUser()
  // cancels this automatically if someone rejoins before it fires.
  if (users.size === 0) {
    roomState.scheduleDeletion(() => {
      serverManager.serverRooms.delete(roomId);
      console.log(`Room ${roomId} deleted because it is empty`);
    }, ROOM_EMPTY_DELETE_DELAY_MS);
  }
}


export default function registerConnectionEventHandlers(io: Server, socket: Socket) {
  console.log("New client connected:", socket.id);

  // Join room
  socket.on("room:join", ({ roomId, user }: RoomJoinEvent) => joinRoom(io, socket, roomId, user));

  // Leave room
  socket.on("room:leave", ({ roomId }: { roomId: string }) => leaveRoom(io, socket, roomId));

  // Disconnect
  socket.on("disconnect", () => disconnect(io, socket));
}