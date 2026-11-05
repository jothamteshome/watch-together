import { nanoid } from "nanoid";
import type { Server, Socket } from "socket.io";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type RoomSnapshot from "@shared/interfaces/RoomSnapshot";
import type User from "@shared/interfaces/User";
import { serverManager } from "../models/RoomManager.js";
import type RoomState from "../models/RoomState.js";
import { getJoinVideoState } from "./videoEventHandlers.js";


/**
 * Sends the joining socket a snapshot of the room (users, chat, video and playlist). If this is
 * the user's first socket in the room, the join is also announced to everyone else;
 * a second tab of a user who is already in the room joins silently.
 */
export function emitRoomSync(io: Server, socket: Socket, roomId: string, roomState: RoomState, isNewMember: boolean) {
    const newUser: User | undefined = serverManager.getUserBySocket(socket.id);

    if (newUser && isNewMember) {
        const joinMessage: ChatMessage = {
            id: nanoid(8),
            user: newUser,
            timestamp: Date.now(),
            systemEvent: "joined"
        };
        roomState.addChatMessage(joinMessage);

        // The joiner gets this message through their own chatHistory below
        console.log("Sending join message");
        socket.broadcast.to(roomId).emit("chat:sync", joinMessage);
    }

    const snapshot: RoomSnapshot = {
        users: roomState.getUsers(),
        chatHistory: roomState.getChatHistory(),
        video: getJoinVideoState(roomId),
        playlist: roomState.getPlaylistState()
    };
    socket.emit("room:sync", snapshot);

    if (newUser && isNewMember) socket.broadcast.to(roomId).emit("user:joined", newUser);
}
