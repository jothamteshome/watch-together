import type { Socket } from "socket.io";
import { describe, expect, it } from "vitest";
import { isMember } from "../src/sockets/isMember.js";


/** Only the part of the socket isMember reads */
function socketIn(roomId?: string) {
    return { data: { roomId } } as unknown as Socket;
}


describe("isMember", () => {
    it("is true only for the room the socket joined", () => {
        // Assert
        expect(isMember(socketIn("room-a"), "room-a")).toBe(true);
        expect(isMember(socketIn("room-a"), "room-b")).toBe(false);
    });

    it.each([undefined, null, 42, {}, ["room-a"]])("is false for a socket that never joined when the payload's roomId is %j", (roomId) => {
        // Assert
        expect(isMember(socketIn(undefined), roomId)).toBe(false);
    });
});
