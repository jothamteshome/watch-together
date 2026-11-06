import type ChatMessage from "@shared/interfaces/ChatMessage";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    collectBroadcast,
    connectClient,
    createRoom,
    disconnectAll,
    joinedName,
    joinRoom,
    NANOID_8,
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
        const roomId = await createRoom(server.url);
        const host = await connectClient(server.url);
        const guest = await connectClient(server.url);
        await joinRoom(host, roomId);
        const { chat: guestJoin } = await joinRoom(guest, roomId, [host]);

        // Act
        const [hostCopy, guestCopy] = await collectBroadcast<ChatMessage>([host, guest], "chat:sync", () =>
            guest.emit("chat:message", { roomId, msg: "hello room" }));

        // Assert: the author is the name the guest was announced under
        const author = joinedName(guestJoin);
        expect(hostCopy).toEqual({
            id: expect.stringMatching(NANOID_8),
            author,
            authorIcon: `https://api.dicebear.com/7.x/identicon/svg?seed=${author}`,
            authorId: guest.id,
            text: "hello room",
            timestamp: expect.any(Number),
            isSystemMessage: false
        });
        expect(guestCopy).toEqual(hostCopy);
    });
});
