import type { Socket } from "socket.io";


/**
 * True if `socket` joined room `roomId`. Every event names its room in the payload, so a handler must check
 * this before acting: otherwise a socket outside the room, or in another one, could change it.
 */
export function isMember(socket: Socket, roomId: unknown): boolean {
    return typeof roomId === "string" && socket.data.roomId === roomId;
}
