import type { Server, Socket } from "socket.io";
import type { UserUpdateEvent } from "@shared/interfaces/UserEvents";
import type User from "@shared/interfaces/User";
import { serverManager } from "../models/RoomManager.js";
import { logger } from "../utils/logger.js";


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
    const parsed = parseUserUpdate(changes);
    if (!parsed) {
        logger.warn({ socketId: socket.id }, "Rejected malformed user:updated payload");
        return;
    }

    const updatedUser: User | undefined = serverManager.updateUser(socket.id, parsed);
    if (!updatedUser) return;

    // One user can have sockets in several rooms (e.g. tabs in different rooms), and
    // every one of those rooms holds its own copy of the profile.
    const roomIds = new Set<string>();
    for (const socketId of serverManager.userSockets.get(updatedUser.id) ?? []) {
        const roomId: string | undefined = io.sockets.sockets.get(socketId)?.data.roomId;
        if (roomId) roomIds.add(roomId);
    }

    for (const roomId of roomIds) {
        serverManager.serverRooms.get(roomId)?.updateUser(updatedUser);

        logger.debug({ roomId, socketId: socket.id }, "User updated their profile");
        io.to(roomId).emit("user:updated", updatedUser);
    }
}


export function registerUserEventHandlers(io: Server, socket: Socket) {
    socket.on("user:updated", (changes: UserUpdateEvent) => handleUserUpdate(io, socket, changes));
}
