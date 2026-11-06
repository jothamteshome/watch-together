import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import type { ChatMessageEvent } from "@shared/interfaces/ChatEvents";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type User from "@shared/interfaces/User";
import { serverManager } from "../models/RoomManager.js";
import { logger } from "../utils/logger.js";



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

    // Metadata only: the text, username and icon of a chat message are never logged
    logger.debug({ roomId, socketId: socket.id, messageId: userMessage.id, length: msg?.length }, "Broadcasting chat:message");
    io.to(roomId).emit("chat:sync", userMessage);
};


export function handleChatLeaveRoom(io: Server, roomId: string, leavingUser: User) {
    const leaveMessage: ChatMessage = {
        id: nanoid(8),
        user: leavingUser,
        timestamp: Date.now(),
        systemEvent: "left"
    };

    serverManager.serverRooms.get(roomId)?.addChatMessage(leaveMessage);

    // Emit leave message to all clients
    logger.debug({ roomId }, "Sending leave message");
    io.to(roomId).emit("chat:sync", leaveMessage);
}


export function handleChatDisconnect(io: Server, roomId: string, leavingUser: User) {
    const disconnectMessage: ChatMessage = {
        id: nanoid(8),
        user: leavingUser,
        timestamp: Date.now(),
        systemEvent: "disconnected"
    };

    serverManager.serverRooms.get(roomId)?.addChatMessage(disconnectMessage);

    // Emit leave message to all clients
    logger.debug({ roomId }, "Sending disconnect message");
    io.to(roomId).emit("chat:sync", disconnectMessage);
}


export function registerChatEventHandlers(io: Server, socket: Socket) {
    // Chat events
    socket.on("chat:message", ({ roomId, msg }: ChatMessageEvent) => handleChatMessage(io, socket, { roomId, msg }));
};
