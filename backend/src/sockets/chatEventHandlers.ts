import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import type { ChatMessageEvent } from "@shared/interfaces/ChatEvents";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type User from "@shared/interfaces/User";
import { serverManager } from "../models/RoomManager.js";



function handleChatMessage(io: Server, socket: Socket, { roomId, msg }: ChatMessageEvent) {
    const user: User | undefined = serverManager.getUserBySocket(socket.id);

    // Build user message
    const userMessage: ChatMessage = {
        id: nanoid(8),
        author: user ? user.username : socket.id,
        authorIcon: user?.icon,
        authorId: socket.id,
        text: msg,
        timestamp: Date.now(),
        isSystemMessage: false
    }


    serverManager.serverRooms.get(roomId)?.addChatMessage(userMessage);

    console.log(`Broadcasting chat:message in room ${roomId}`);
    console.log(userMessage);
    io.to(roomId).emit("chat:sync", userMessage);
};


export function handleChatLeaveRoom(io: Server, socket: Socket, roomId: string) {
    const systemUser: User | undefined = serverManager.serverUsers.get('system');
    const leavingUser: User | undefined = serverManager.getUserBySocket(socket.id);
    const leavingUserName: string = leavingUser ? leavingUser.username : socket.id;

    const leaveMessage: ChatMessage = {
        id: nanoid(8),
        author: systemUser ? systemUser.username : "[SYSTEM]",
        authorIcon: systemUser?.icon,
        text: `${leavingUserName} has left the room.`,
        timestamp: Date.now(),
        isSystemMessage: true
    };

    serverManager.serverRooms.get(roomId)?.addChatMessage(leaveMessage);

    // Emit leave message to all clients
    console.log("Sending leave message");
    io.to(roomId).emit("chat:sync", leaveMessage);
}


export function handleChatDisconnect(io: Server, socket: Socket, roomId: string) {
    const systemUser: User | undefined = serverManager.serverUsers.get('system');
    const leavingUser: User | undefined = serverManager.getUserBySocket(socket.id);
    const leavingUserName: string = leavingUser ? leavingUser.username : socket.id;

    const disconnectMessage: ChatMessage = {
        id: nanoid(8),
        author: systemUser ? systemUser.username : "[SYSTEM]",
        authorIcon: systemUser?.icon,
        text: `${leavingUserName} has disconnected from the room.`,
        timestamp: Date.now(),
        isSystemMessage: true
    };

    serverManager.serverRooms.get(roomId)?.addChatMessage(disconnectMessage);

    // Emit leave message to all clients
    console.log("Sending disconnect message");
    io.to(roomId).emit("chat:sync", disconnectMessage);
}


export function registerChatEventHandlers(io: Server, socket: Socket) {
    // Chat events
    socket.on("chat:message", ({ roomId, msg }: ChatMessageEvent) => handleChatMessage(io, socket, { roomId, msg }));
};