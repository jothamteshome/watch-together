import { nanoid } from "nanoid";
import type { Server, Socket } from "socket.io";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type RoomSnapshot from "@shared/interfaces/RoomSnapshot";
import type User from "@shared/interfaces/User";
import { serverManager } from "../models/RoomManager.js";
import type RoomState from "../models/RoomState.js";


/**
 * Sends the joining socket a snapshot of the room (users + chat history) and
 * announces the join to everyone else in the room.
 */
export function emitRoomSync(io: Server, socket: Socket, roomId: string, roomState: RoomState) {
    const newUser: User | undefined = serverManager.getUserBySocket(socket.id);
    const newUserName: string = newUser ? newUser.username : socket.id;
    const systemUser: User | undefined = serverManager.serverUsers.get('system');

    const joinMessage: ChatMessage = {
        id: nanoid(8),
        author: systemUser ? systemUser.username : "[SYSTEM]",
        authorIcon: systemUser?.icon,
        text: `${newUserName} has joined the room.`,
        timestamp: Date.now(),
        isSystemMessage: true
    };
    roomState.addChatMessage(joinMessage);

    // The joiner gets this message through their own chatHistory below
    console.log("Sending join message");
    socket.broadcast.to(roomId).emit("chat:sync", joinMessage);

    const snapshot: RoomSnapshot = { users: roomState.getUsers(), chatHistory: roomState.getChatHistory() };
    socket.emit("room:sync", snapshot);

    if (newUser) socket.broadcast.to(roomId).emit("user:joined", newUser);
}
