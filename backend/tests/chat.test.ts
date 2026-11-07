import type ChatMessage from "@shared/interfaces/ChatMessage";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    collectBroadcast,
    disconnectAll,
    NANOID_8,
    setupRoom,
    startServer,
    type TestServer
} from "./helpers.js";


let server: TestServer;

beforeAll(async () => {
    server = await startServer();
});

afterEach(() => disconnectAll());

afterAll(() => server.close());


describe("chat:message", () => {
    it("broadcasts a member's message to every member, sender included", async () => {
        // Arrange
        const { roomId, host, guest, guestUser } = await setupRoom(server.url);

        // Act
        const [hostCopy, guestCopy] = await collectBroadcast<ChatMessage>([host, guest], "chat:sync", () =>
            guest.emit("chat:message", { roomId, msg: "hello room" }));

        // Assert: the sender is the profile the guest joined with
        expect(hostCopy).toEqual({
            id: expect.stringMatching(NANOID_8),
            user: guestUser,
            text: "hello room",
            timestamp: expect.any(Number)
        });
        expect(guestCopy).toEqual(hostCopy);
    });

    it("broadcasts a message of exactly the 1000 character limit", async () => {
        // Arrange
        const { roomId, host, guest } = await setupRoom(server.url);
        const msg = "x".repeat(1000);

        // Act
        const [hostCopy] = await collectBroadcast<ChatMessage>([host, guest], "chat:sync", () =>
            host.emit("chat:message", { roomId, msg }));

        // Assert
        expect(hostCopy.text).toBe(msg);
    });
});
