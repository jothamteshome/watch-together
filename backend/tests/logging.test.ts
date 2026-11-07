import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { logger } from "../src/utils/logger.js";
import {
    chatBarrier,
    collectBroadcast,
    connectClient,
    createRoom,
    disconnectAll,
    joinRoom,
    NANOID_8,
    roomBarrier,
    startServer,
    startItem,
    testUser,
    type TestServer
} from "./helpers.js";


// Distinctive strings that must never show up in a log call, whatever the level
const USERNAME = "SentinelUser-4f9c";
const RENAMED = "SentinelRenamed-4f9c";
const REJECTED_NAME = "SentinelRejected-4f9c";
const CHAT_TEXT = "sentinel chat text 4f9c";
const STRAY_ROOM = "SentinelRoom-4f9c";
const VIDEO_URL = "https://www.youtube.com/watch?v=SENTINEL4f9";


let server: TestServer;
let spies: MockInstance[];

beforeAll(async () => {
    server = await startServer();
});

// The logger is silent under vitest, but a spy still records every call whatever the level
beforeEach(() => {
    spies = [
        vi.spyOn(logger, "debug"),
        vi.spyOn(logger, "info"),
        vi.spyOn(logger, "warn"),
        vi.spyOn(logger, "error")
    ];
});

afterEach(() => {
    disconnectAll();
    vi.restoreAllMocks();
});

afterAll(() => server.close());


/** Everything passed to the logger since the spies were armed, flattened to one string */
function loggedText(): string {
    return JSON.stringify(spies.flatMap(spy => spy.mock.calls));
}


/** A room whose host carries the sentinel username, with a guest to observe it */
async function setupSentinelRoom() {
    const roomId = await createRoom(server.url);
    const host = await connectClient(server.url);
    const guest = await connectClient(server.url);
    const hostUser = testUser(USERNAME);
    const guestUser = testUser("Guest");

    await joinRoom(host, roomId, hostUser);
    await joinRoom(guest, roomId, guestUser, [host]);

    return { roomId, host, guest, hostUser, guestUser };
}


// Keep this first: no socket is connected yet, so any log call here would come from the health route
describe("GET /health", () => {
    it("logs nothing, because the frontend polls it every few seconds", async () => {
        // Act
        await fetch(`${server.url}/health`);
        await fetch(`${server.url}/health`);

        // Assert
        for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    });
});


describe("chat:message", () => {
    it("logs the room, sender socket and message length, but not the text, username or profile", async () => {
        // Arrange
        const { roomId, host, hostUser } = await setupSentinelRoom();

        // Act
        await chatBarrier(host, roomId, CHAT_TEXT);

        // Assert
        expect(logger.debug).toHaveBeenCalledWith(
            { roomId, socketId: host.id, messageId: expect.stringMatching(NANOID_8), length: CHAT_TEXT.length },
            "Broadcasting chat:message"
        );
        for (const secret of [CHAT_TEXT, USERNAME, hostUser.id, hostUser.icon]) {
            expect(loggedText()).not.toContain(secret);
        }
    });
});


describe("user-supplied content", () => {
    it("does not log the roomId of a room:leave for a room the socket is not in", async () => {
        // Arrange
        const { roomId, guest, guestUser } = await setupSentinelRoom();

        // Act: a join on the same socket orders the stray leave before it, so the server has handled the leave
        guest.emit("room:leave", { roomId: STRAY_ROOM });
        await joinRoom(guest, roomId, guestUser);

        // Assert
        expect(loggedText()).not.toContain(STRAY_ROOM);
    });

    it("never reaches the log: renames, queued videos and the payloads of rejected events", async () => {
        // Arrange
        const room = await setupSentinelRoom();
        const { roomId, host, guest } = room;

        // Act: a rename and a queued video are accepted
        await collectBroadcast([host, guest], "user:updated", () => host.emit("user:updated", { username: RENAMED }));
        await startItem(room, VIDEO_URL);

        // Act: a malformed join, a bare-string event and an invalid rename are all rejected
        host.emit("room:join", { roomId, user: { id: "", username: REJECTED_NAME, icon: "" } });
        guest.emit("chat:message", `${REJECTED_NAME} sent as a bare string`);
        guest.emit("user:updated", { username: REJECTED_NAME.repeat(10) });
        await roomBarrier(roomId, [host, guest]);

        // Assert: the rejections are visible, with the event but never the payload
        expect(logger.warn).toHaveBeenCalledWith({ socketId: host.id }, "Rejected room:join with a malformed user");
        expect(logger.warn).toHaveBeenCalledWith({ socketId: guest.id, event: "chat:message" }, "Dropped event with a non-object payload");
        expect(logger.warn).toHaveBeenCalledWith({ socketId: guest.id }, "Rejected malformed user:updated payload");

        // Assert: none of the content was logged
        for (const secret of [USERNAME, RENAMED, REJECTED_NAME, VIDEO_URL, room.hostUser.id, room.hostUser.icon]) {
            expect(loggedText()).not.toContain(secret);
        }
    });
});
