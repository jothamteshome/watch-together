import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import type { ChatMessageEvent } from "@shared/interfaces/ChatEvents";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type User from "@shared/interfaces/User";
import { serverManager } from "../models/RoomManager.js";



function handleChatMessage(io: Server, socket: Socket, { roomId, msg }: ChatMessageEvent) {
    const user: User | undefined = serverManager.getUserBySocket(socket.id);
    if (!user) return;

    // Build user message
    const userMessage: ChatMessage = {
        id: nanoid(8),
        user,
        text: msg,
        timestamp: Date.now()
    }


    serverManager.serverRooms.get(roomId)?.addChatMessage(userMessage);

    console.log(`Broadcasting chat:message in room ${roomId}`);
    console.log(userMessage);
    io.to(roomId).emit("chat:sync", userMessage);
};


export function handleChatLeaveRoom(io: Server, socket: Socket, roomId: string) {
    const leavingUser: User | undefined = serverManager.getUserBySocket(socket.id);
    if (!leavingUser) return;

    const leaveMessage: ChatMessage = {
        id: nanoid(8),
        user: leavingUser,
        timestamp: Date.now(),
        systemEvent: "left"
    };

    serverManager.serverRooms.get(roomId)?.addChatMessage(leaveMessage);

    // Emit leave message to all clients
    console.log("Sending leave message");
    io.to(roomId).emit("chat:sync", leaveMessage);
}


export function handleChatDisconnect(io: Server, socket: Socket, roomId: string) {
    const leavingUser: User | undefined = serverManager.getUserBySocket(socket.id);
    if (!leavingUser) return;

    const disconnectMessage: ChatMessage = {
        id: nanoid(8),
        user: leavingUser,
        timestamp: Date.now(),
        systemEvent: "disconnected"
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
