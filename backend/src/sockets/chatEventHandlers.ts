import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import type { ChatMessageEvent } from "../interfaces/ChatEvents.js";
import type ChatMessage from "../interfaces/ChatMessage.js";


export function handleChatJoinRoom(io: Server, socket: Socket, roomId: string) {
    const joinMessage: ChatMessage = {
        id: nanoid(8),
        author: "[SYSTEM]",
        text: `${socket.id} has joined the room.`,
        timestamp: Date.now()
    };

    // Emit join message to all clients
    console.log("Sending join message");
    io.to(roomId).emit("chat:sync", joinMessage);
}


function handleChatMessage(io: Server, socket: Socket, { roomId, msg }: ChatMessageEvent) {
    // Build user message
    const userMessage: ChatMessage = {
        id: nanoid(8),
        author: socket.id,
        text: msg,
        timestamp: Date.now()
    }


    console.log(`Broadcasting chat:message in room ${roomId}`);
    console.log(userMessage);
    io.to(roomId).emit("chat:sync", userMessage);
};


export function handleChatLeaveRoom(io: Server, socket: Socket, roomId: string) {
    const leaveMessage: ChatMessage = {
        id: nanoid(8),
        author: "[SYSTEM]",
        text: `${socket.id} has left the room.`,
        timestamp: Date.now()
    };

    // Emit leave message to all clients
    console.log("Sending leave message");
    io.to(roomId).emit("chat:sync", leaveMessage);
}


export function handleChatDisconnect(io: Server, socket: Socket, roomId: string) {
    const disconnectMessage: ChatMessage = {
        id: nanoid(8),
        author: "[SYSTEM]",
        text: `${socket.id} has disconnected from the room.`,
        timestamp: Date.now()
    };

    // Emit leave message to all clients
    console.log("Sending disconnect message");
    io.to(roomId).emit("chat:sync", disconnectMessage);
}


export function registerChatEventHandlers(io: Server, socket: Socket) {
    // Chat events
    socket.on("chat:message", ({ roomId, msg }: ChatMessageEvent) => handleChatMessage(io, socket, { roomId, msg }));
};