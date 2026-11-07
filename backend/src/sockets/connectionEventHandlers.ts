import type { Server, Socket } from "socket.io";
import { handleChatLeaveRoom, handleChatDisconnect } from "./chatEventHandlers.js";
import { emitRoomSync } from "./roomSyncHandlers.js";
import { serverManager } from "../models/RoomManager.js";
import type RoomState from "../models/RoomState.js";
import { logger } from "../utils/logger.js";
import type { RoomJoinEvent } from "@shared/interfaces/RoomEvents";
import type User from "@shared/interfaces/User";

const ROOM_EMPTY_DELETE_DELAY_MS = 1000 * 60 * 60; // 1 hour


/** The joining user comes from the client, so check its shape before storing it */
function isUser(user: unknown): user is User {
  if (typeof user !== "object" || user === null) return false;

  const { id, username, icon } = user as Record<string, unknown>;
  return typeof id === "string" && id !== "" && typeof username === "string" && typeof icon === "string";
}


/**
 * Handle room join events from socket.IO
 * @param socket The current socket
 * @param roomId The current roomId to handle join events for
 */
function joinRoom(io: Server, socket: Socket, roomId: string, user: User) {
  if (!isUser(user)) {
    logger.warn({ socketId: socket.id }, "Rejected room:join with a malformed user");
    return;
  }

  const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
  if (!roomState) return;

  // Moving rooms: leave the old one first. leaveRoom unregisters the socket, so it must run
  // before addUser and registerConnection below.
  if (socket.data.roomId && socket.data.roomId !== roomId) leaveRoom(io, socket, socket.data.roomId);

  // Only the user's first socket in the room counts as them joining it
  const isNewMember = !roomState.hasUser(user.id);

  roomState.addUser(user, socket.id);
  socket.data.roomId = roomId;

  serverManager.serverRooms.set(roomId, roomState);
  serverManager.registerConnection(socket.id, user);

  // Join the room
  socket.join(roomId);

  // Log user joining room
  logger.info({ socketId: socket.id, roomId }, "Socket joined room");

  emitRoomSync(io, socket, roomId, roomState, isNewMember);
}


function leaveRoom(io: Server, socket: Socket, roomId: string) {
  socket.leave(roomId);
  logger.info({ socketId: socket.id, roomId }, "Socket left room");

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
  logger.debug({ socketId: socket.id }, "Client disconnected");

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
    logger.debug({ socketId: socket.id, roomId }, "Removing socket from room users");
    serverManager.disconnectSocket(socket.id);
    userLeftRoom = !roomState.hasUser(userId);
  }

  // If users list for room is empty, schedule the room for deletion. addUser()
  // cancels this automatically if someone rejoins before it fires.
  if (roomState.getUserCount() === 0) {
    roomState.scheduleDeletion(() => {
      serverManager.serverRooms.delete(roomId);
      logger.info({ roomId }, "Room deleted because it is empty");
    }, ROOM_EMPTY_DELETE_DELAY_MS);
  }

  return userLeftRoom;
}


export default function registerConnectionEventHandlers(io: Server, socket: Socket) {
  logger.debug({ socketId: socket.id }, "New client connected");

  // Join room
  socket.on("room:join", ({ roomId, user }: RoomJoinEvent) => joinRoom(io, socket, roomId, user));

  // Leave room
  socket.on("room:leave", ({ roomId }: { roomId: string }) => leaveRoom(io, socket, roomId));

  // Disconnect
  socket.on("disconnect", () => disconnect(io, socket));
}