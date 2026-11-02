import type { Server, Socket } from "socket.io";
import type { UserUpdateEvent } from "@shared/interfaces/UserEvents";
import type User from "@shared/interfaces/User";
import { serverManager } from "../models/RoomManager.js";


// The longest name generateUser() can produce is 38 characters, so a generated name is never rejected.
const MAX_USERNAME_LENGTH = 40;
const MAX_ICON_URL_LENGTH = 2048;


function isHttpUrl(value: string): boolean {
    try {
        const { protocol } = new URL(value);
        return protocol === "http:" || protocol === "https:";
    } catch {
        return false;
    }
}


/**
 * Validates a client-supplied profile change. Returns only the fields to apply,
 * or null if the payload is malformed, a provided field is invalid, or it changes nothing.
 */
function parseUserUpdate(changes: UserUpdateEvent): UserUpdateEvent | null {
    if (!changes || typeof changes !== "object") return null;

    const parsed: UserUpdateEvent = {};

    if (changes.username !== undefined) {
        if (typeof changes.username !== "string") return null;

        const username = changes.username.trim();
        if (username === "" || username.length > MAX_USERNAME_LENGTH) return null;
        parsed.username = username;
    }

    if (changes.icon !== undefined) {
        if (typeof changes.icon !== "string") return null;
        if (changes.icon.length > MAX_ICON_URL_LENGTH || !isHttpUrl(changes.icon)) return null;
        parsed.icon = changes.icon;
    }

    return Object.keys(parsed).length > 0 ? parsed : null;
}


function handleUserUpdate(io: Server, socket: Socket, changes: UserUpdateEvent) {
    const roomId: string | undefined = socket.data.roomId;
    if (!roomId) return;

    const parsed = parseUserUpdate(changes);
    if (!parsed) return;

    const updatedUser: User | undefined = serverManager.updateUser(socket.id, parsed);
    if (!updatedUser) return;

    serverManager.serverRooms.get(roomId)?.updateUser(updatedUser);

    console.log(`User ${updatedUser.id} updated their profile in room ${roomId}`);
    io.to(roomId).emit("user:updated", updatedUser);
}


export function registerUserEventHandlers(io: Server, socket: Socket) {
    socket.on("user:updated", (changes: UserUpdateEvent) => handleUserUpdate(io, socket, changes));
}
