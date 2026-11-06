import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
    chatBarrier,
    connectClient,
    createRoom,
    disconnectAll,
    joinRoom,
    setupRoom,
    startServer,
    testUser,
    type TestServer
} from "./helpers.js";


// Socket.IO runs handlers without a try/catch, so a handler that throws becomes an uncaughtException,
// which ends the process in production. Under vitest the worker survives, so the tests collect them.
const uncaught: unknown[] = [];
const collect = (error: unknown) => uncaught.push(error);


let server: TestServer;

beforeAll(async () => {
    server = await startServer();
});

beforeEach(() => {
    uncaught.length = 0;
    process.on("uncaughtException", collect);
});

afterEach(() => {
    process.off("uncaughtException", collect);
    disconnectAll();
});

afterAll(() => server.close());


describe("malformed payloads", () => {
    it.each([
        "room:join",
        "room:leave",
        "video:play",
        "video:pause",
        "video:seek",
        "video:playbackrate",
        "playlist:add",
        "playlist:next",
        "playlist:select",
        "chat:message",
        "user:updated"
    ])("drops %s with a null payload without crashing the server", async (event) => {
        // Arrange
        const { roomId, host } = await setupRoom(server.url);

        // Act: the barrier on the same socket is handled after the bad event
        host.emit(event, null);
        const barrier = await chatBarrier(host, roomId);

        // Assert: the room still answers its member
        expect(uncaught).toEqual([]);
        expect(barrier.text).toBe("barrier");
    });

    it.each([
        { case: "no user", user: undefined },
        { case: "a null user", user: null },
        { case: "a user without a string id", user: { id: 1, username: "Bad", icon: "https://example.test/bad.png" } },
        { case: "a user without a username", user: { id: "bad-user", icon: "https://example.test/bad.png" } }
    ])("ignores a room:join with $case", async ({ user }) => {
        // Arrange
        const roomId = await createRoom(server.url);
        const client = await connectClient(server.url);
        const member = testUser("Member");
        const events: string[] = [];
        client.onAny(event => events.push(event));

        // Act: a valid join on the same socket afterwards orders the bad one before it
        client.emit("room:join", { roomId, user });
        const snapshot = await joinRoom(client, roomId, member);

        // Assert: only the valid join was answered, and only its user is in the room
        expect(uncaught).toEqual([]);
        expect(events).toEqual(["room:sync"]);
        expect(snapshot.users).toEqual({ [member.id]: member });
    });
});
