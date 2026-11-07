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


const VIDEO_URL = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
const validVideo = { time: 10, playbackRate: 1, eventId: 0 };
const VIDEO_EVENTS = ["video:play", "video:pause", "video:seek", "video:playbackrate"];

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
        { case: "a user without a username", user: { id: "bad-user", icon: "https://example.test/bad.png" } },
        { case: "a user without an icon", user: { id: "bad-user", username: "Bad" } },
        { case: "a user with an empty id", user: { id: "", username: "Bad", icon: "https://example.test/bad.png" } }
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


describe("events from a member of another room", () => {
    it.each([
        { event: "chat:message", payload: { msg: "hello" } },
        ...VIDEO_EVENTS.map(event => ({ event, payload: validVideo }))
    ])("ignores $event sent to a room the socket is not in", async ({ event, payload }) => {
        // Arrange
        const { roomId, host } = await setupRoom(server.url);
        const otherRoomId = await createRoom(server.url);
        const member = await connectClient(server.url);
        await joinRoom(member, otherRoomId, testUser("Member"));
        const events: string[] = [];
        host.onAny(name => events.push(name));

        // Act: the member's barrier in its own room orders its traffic: the server has handled the event
        member.emit(event, { roomId, ...payload });
        await chatBarrier(member, otherRoomId);
        await chatBarrier(host, roomId);

        // Assert
        expect(uncaught).toEqual([]);
        expect(events).toEqual(["chat:sync"]);
    });
});


describe("events for a room that does not exist", () => {
    it.each([
        "video:play",
        "video:pause",
        "video:seek",
        "video:playbackrate",
        "playlist:add",
        "playlist:next",
        "playlist:select",
        "chat:message"
    ])("ignores %s without crashing the server", async (event) => {
        // Arrange: a payload that would be valid in a real room
        const { roomId, host } = await setupRoom(server.url);
        const events: string[] = [];
        host.onAny(name => events.push(name));

        // Act
        host.emit(event, {
            roomId: "no-such-room",
            time: 10,
            playbackRate: 1,
            eventId: 99,
            videoUrl: VIDEO_URL,
            videoService: "youtube",
            itemId: "no-such-item",
            msg: "hello"
        });
        await chatBarrier(host, roomId);

        // Assert
        expect(uncaught).toEqual([]);
        expect(events).toEqual(["chat:sync"]);
    });
});


describe("events from a socket that never joined a room", () => {
    it.each([
        { event: "chat:message", payload: { msg: "hello" } },
        { event: "user:updated", payload: { username: "Intruder" } },
        ...VIDEO_EVENTS.map(event => ({ event, payload: validVideo }))
    ])("ignores $event without crashing the server", async ({ event, payload }) => {
        // Arrange
        const { roomId, host } = await setupRoom(server.url);
        const outsider = await connectClient(server.url);
        const events: string[] = [];
        host.onAny(name => events.push(name));

        // Act: joining a room afterwards orders the outsider's traffic: the server has handled the event
        outsider.emit(event, { roomId, ...payload });
        await joinRoom(outsider, await createRoom(server.url), testUser("Outsider"));
        await chatBarrier(host, roomId);

        // Assert
        expect(uncaught).toEqual([]);
        expect(events).toEqual(["chat:sync"]);
    });
});


describe("payloads missing a field", () => {
    it.each(["video:play", "video:pause", "video:seek", "video:playbackrate"].flatMap(event => [
        { case: "no time", payload: { playbackRate: 1, eventId: 0 } },
        { case: "a 50 KB string time", payload: { ...validVideo, time: "9".repeat(50_000) } },
        { case: "a negative time", payload: { ...validVideo, time: -1 } },
        { case: "a non-numeric playbackRate", payload: { ...validVideo, playbackRate: "fast" } },
        { case: "a zero playbackRate", payload: { ...validVideo, playbackRate: 0 } },
        { case: "no eventId", payload: { time: 10, playbackRate: 1 } },
        { case: "a string eventId", payload: { ...validVideo, eventId: "0" } }
    ].map(bad => ({ event, ...bad })))
    )("drops $event with $case", async ({ event, payload }) => {
        // Arrange
        const { roomId, host } = await setupRoom(server.url);
        const events: string[] = [];
        host.onAny(name => events.push(name));

        // Act
        host.emit(event, { roomId, ...payload });
        await chatBarrier(host, roomId);

        // Assert: nothing was broadcast before the barrier
        expect(events).toEqual(["chat:sync"]);
    });

    it.each([
        { case: "no videoUrl", payload: { videoService: "youtube" } },
        { case: "an empty videoUrl", payload: { videoUrl: "", videoService: "youtube" } },
        { case: "a non-string videoUrl", payload: { videoUrl: 42, videoService: "youtube" } },
        { case: "no videoService", payload: { videoUrl: VIDEO_URL } },
        { case: "an unsupported videoService", payload: { videoUrl: VIDEO_URL, videoService: "tiktok" } },
        { case: "an inherited object key as the videoService", payload: { videoUrl: VIDEO_URL, videoService: "toString" } }
    ])("drops playlist:add with $case", async ({ payload }) => {
        // Arrange
        const { roomId, host } = await setupRoom(server.url);
        const events: string[] = [];
        host.onAny(name => events.push(name));

        // Act
        host.emit("playlist:add", { roomId, ...payload });
        await chatBarrier(host, roomId);

        // Assert: nothing was broadcast before the barrier
        expect(events).toEqual(["chat:sync"]);
    });

    it.each([
        { case: "no msg", payload: {} },
        { case: "a non-string msg", payload: { msg: 42 } },
        { case: "an empty msg", payload: { msg: "" } },
        { case: "a msg of only whitespace", payload: { msg: "  \n\t " } },
        { case: "a msg one character over the limit", payload: { msg: "x".repeat(1001) } },
        { case: "a 50 KB msg", payload: { msg: "x".repeat(50_000) } }
    ])("drops chat:message with $case", async ({ payload }) => {
        // Arrange
        const { roomId, host } = await setupRoom(server.url);
        const events: string[] = [];
        host.onAny(name => events.push(name));

        // Act
        host.emit("chat:message", { roomId, ...payload });
        await chatBarrier(host, roomId);

        // Assert: nothing was broadcast before the barrier
        expect(events).toEqual(["chat:sync"]);
    });
});


describe("oversized packets", () => {
    const MAX_PACKET = 64 * 1024;

    it.each([
        { event: "chat:message", payload: { msg: "x".repeat(MAX_PACKET) } },
        { event: "room:leave", payload: { roomId: "x".repeat(MAX_PACKET) } },
        { event: "room:join", payload: { roomId: "room", user: { id: "u", username: "n", icon: "x".repeat(MAX_PACKET) } } }
    ])("disconnects a client that sends a $event larger than 64 KB", async ({ event, payload }) => {
        // Arrange
        const { roomId, host, guest } = await setupRoom(server.url);
        const closed = new Promise<string>(resolve => host.once("disconnect", resolve));

        // Act
        host.emit(event, { roomId, ...payload });

        // Assert: the sender is cut off, and the room still answers its other member
        expect(await closed).toBe("transport close");
        expect(uncaught).toEqual([]);
        expect((await chatBarrier(guest, roomId)).text).toBe("barrier");
    });
});
