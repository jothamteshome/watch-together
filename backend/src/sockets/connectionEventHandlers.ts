import type { Server, Socket } from "socket.io";
import { handleChatLeaveRoom, handleChatDisconnect } from "./chatEventHandlers.js";
import { emitRoomSync } from "./roomSyncHandlers.js";
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

  // Only the user's first socket in the room counts as them joining it
  const isNewMember = !roomState.hasUser(user.id);

  roomState.addUser(user, socket.id);
  socket.data.roomId = roomId;

  serverManager.serverRooms.set(roomId, roomState);
  serverManager.registerConnection(socket.id, user);

  // Join the room
  socket.join(roomId);

  // Log user joining room
  console.log(`${socket.id} joined room ${roomId} as user ${user.id} (${user.username})`);

  emitRoomSync(io, socket, roomId, roomState, isNewMember);
}


function leaveRoom(io: Server, socket: Socket, roomId: string) {
  socket.leave(roomId);
  console.log(`${socket.id} left room ${roomId}`);

  // Resolve the user first: cleanup unregisters the socket
  const user: User | undefined = serverManager.getUserBySocket(socket.id);

  // Remove user from room users
  const userLeftRoom = disconnectCleanup(socket, roomId, serverManager.serverRooms.get(roomId));
  if (user && userLeftRoom) {
    handleChatLeaveRoom(io, roomId, user);
    io.to(roomId).emit("user:left", user.id);
  }

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

  // Resolve the user first: cleanup unregisters the socket
  const user: User | undefined = serverManager.getUserBySocket(socket.id);

  const userLeftRoom = disconnectCleanup(socket, roomId, serverManager.serverRooms.get(roomId));
  if (user && userLeftRoom) {
    handleChatDisconnect(io, roomId, user);
    io.to(roomId).emit("user:left", user.id);
  }
}


/**
 * Helper function to cleanup unused rooms from in-memory store
 * @param socket The current socket being disconnected from
 * @param roomId The current roomId to remove the socket from
 * @returns true if this was the user's last socket in the room, i.e. the user has left it
 */
function disconnectCleanup(socket: Socket, roomId: string, roomState?: RoomState): boolean {
  if (!roomState) return false;

  // Get userId from socket id of user in room
  const userId = serverManager.socketUserIds.get(socket.id);
  let userLeftRoom = false;

  // If socket id exists in room users, remove from rooms users
  if (userId && roomState.removeUser(userId, socket.id)) {
    console.log(`Removing socket ${socket.id} from room users`);
    serverManager.disconnectSocket(socket.id);
    userLeftRoom = !roomState.hasUser(userId);
  }

  // If users list for room is empty, schedule the room for deletion. addUser()
  // cancels this automatically if someone rejoins before it fires.
  if (roomState.getUserCount() === 0) {
    roomState.scheduleDeletion(() => {
      serverManager.serverRooms.delete(roomId);
      console.log(`Room ${roomId} deleted because it is empty`);
    }, ROOM_EMPTY_DELETE_DELAY_MS);
  }

  return userLeftRoom;
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