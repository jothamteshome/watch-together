import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import type { ChatMessageEvent } from "../interfaces/ChatEvents.js";
import type ChatMessage from "../interfaces/ChatMessage.js";
import type User from "../interfaces/User.js";
import { roomManager } from "../models/RoomManager.js";



export function handleChatJoinRoom(io: Server, socket: Socket, roomId: string) {
    const systemUser: User | undefined = roomManager.userObjects.get('system');
    const leavingUser: User | undefined = roomManager.userObjects.get(socket.id);
    const leavingUserName: string = leavingUser ? leavingUser.username : socket.id;

    const joinMessage: ChatMessage = {
        id: nanoid(8),
        author: systemUser ? systemUser.username : "[SYSTEM]",
        authorIcon: systemUser?.icon,
        text: `${leavingUserName} has joined the room.`,
        timestamp: Date.now(),
        isSystemMessage: true
    };

    // Emit join message to all clients
    console.log("Sending join message");
    io.to(roomId).emit("chat:sync", joinMessage);
}


function handleChatMessage(io: Server, socket: Socket, { roomId, msg }: ChatMessageEvent) {
    const user: User | undefined = roomManager.userObjects.get(socket.id);

    // Build user message
    const userMessage: ChatMessage = {
        id: nanoid(8),
        author: user ? user.username : socket.id,
        authorIcon: user?.icon,
        text: msg,
        timestamp: Date.now(),
        isSystemMessage: false
    }


    console.log(`Broadcasting chat:message in room ${roomId}`);
    console.log(userMessage);
    io.to(roomId).emit("chat:sync", userMessage);
};


export function handleChatLeaveRoom(io: Server, socket: Socket, roomId: string) {
    const systemUser: User | undefined = roomManager.userObjects.get('system');
    const leavingUser: User | undefined = roomManager.userObjects.get(socket.id);
    const leavingUserName: string = leavingUser ? leavingUser.username : socket.id;

    const leaveMessage: ChatMessage = {
        id: nanoid(8),
        author: systemUser ? systemUser.username : "[SYSTEM]",
        authorIcon: systemUser?.icon,
        text: `${leavingUserName} has left the room.`,
        timestamp: Date.now(),
        isSystemMessage: true
    };

    // Emit leave message to all clients
    console.log("Sending leave message");
    io.to(roomId).emit("chat:sync", leaveMessage);
}


export function handleChatDisconnect(io: Server, socket: Socket, roomId: string) {
    const systemUser: User | undefined = roomManager.userObjects.get('system');
    const leavingUser: User | undefined = roomManager.userObjects.get(socket.id);
    const leavingUserName: string = leavingUser ? leavingUser.username : socket.id;

    const disconnectMessage: ChatMessage = {
        id: nanoid(8),
        author: systemUser ? systemUser.username : "[SYSTEM]",
        authorIcon: systemUser?.icon,
        text: `${leavingUserName} has disconnected from the room.`,
        timestamp: Date.now(),
        isSystemMessage: true
    };

    // Emit leave message to all clients
    console.log("Sending disconnect message");
    io.to(roomId).emit("chat:sync", disconnectMessage);
}


export function registerChatEventHandlers(io: Server, socket: Socket) {
    // Chat events
    socket.on("chat:message", ({ roomId, msg }: ChatMessageEvent) => handleChatMessage(io, socket, { roomId, msg }));
};