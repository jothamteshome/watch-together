import type { PlaylistState } from "@shared/interfaces/States";
import type User from "@shared/interfaces/User";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    addItem,
    chatBarrier,
    collectBroadcast,
    connectClient,
    disconnectAll,
    joinRoom,
    NANOID_8,
    setupRoom,
    startItem,
    startServer,
    testUser,
    type Room,
    type TestServer
} from "./helpers.js";


const VIDEO_A = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
const VIDEO_B = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
const VIDEO_C = "https://www.youtube.com/watch?v=ccccccccccc";

/** Expected stored form of a video `addedBy` queued */
function item(videoUrl: string, addedBy: User) {
    return { id: expect.stringMatching(NANOID_8), videoUrl, videoService: "youtube", addedBy };
}

/** Emits a playlist event from the host as the frontend does (no eventId) and resolves with each member's playlist:sync */
function playlistSync(room: Room, event: string, payload: object = {}) {
    return collectBroadcast<PlaylistState>([room.host, room.guest], "playlist:sync", () =>
        room.host.emit(event, { roomId: room.roomId, ...payload }));
}

/** Reports that the current item of `state` ended, as each member's player does */
function next(room: Room, state: PlaylistState) {
    return playlistSync(room, "playlist:next", { itemId: state.items[state.currentIndex]!.id });
}


let server: TestServer;

beforeAll(async () => {
    server = await startServer();
});

afterEach(() => disconnectAll());

afterAll(() => server.close());


describe("playlist:add", () => {
    it("selects the first video added and broadcasts to every member", async () => {
        // Arrange
        const room = await setupRoom(server.url);

        // Act
        const { playlist: synced } = await startItem(room, VIDEO_A);

        // Assert
        const expected = { eventId: 1, items: [item(VIDEO_A, room.hostUser)], currentIndex: 0, isLooping: false };
        expect(synced).toEqual([expected, expected]);
    });

    it("appends later videos without moving the current index", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);

        // Act
        const [state] = await addItem(room, VIDEO_B);

        // Assert
        expect(state).toEqual({
            eventId: 2,
            items: [item(VIDEO_A, room.hostUser), item(VIDEO_B, room.hostUser)],
            currentIndex: 0,
            isLooping: false
        });
    });

    it("selects a video added after the playlist has ended", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        const { playlist: [started] } = await startItem(room, VIDEO_A);
        await next(room, started);

        // Act
        const { playlist: [state] } = await startItem(room, VIDEO_B);

        // Assert
        expect(state).toEqual({
            eventId: 3,
            items: [item(VIDEO_A, room.hostUser), item(VIDEO_B, room.hostUser)],
            currentIndex: 1,
            isLooping: false
        });
    });
});


describe("playlist:next", () => {
    it("advances one item at a time, then ends at -1 and ignores a late report of the last item", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        const [queued] = await addItem(room, VIDEO_B);

        // Act
        const [second] = await next(room, queued);
        const [ended] = await next(room, second);
        const hostEvents: string[] = [];
        room.host.onAny(event => hostEvents.push(event));
        room.host.emit("playlist:next", { roomId: room.roomId, itemId: second.items[1]!.id });
        await chatBarrier(room.host, room.roomId);

        // Assert
        const items = [item(VIDEO_A, room.hostUser), item(VIDEO_B, room.hostUser)];
        expect(second).toEqual({ eventId: 3, items, currentIndex: 1, isLooping: false });
        expect(ended).toEqual({ eventId: 4, items, currentIndex: -1, isLooping: false });
        expect(hostEvents).toEqual(["chat:sync"]);
    });

    it.each([
        { case: "an item is playing", arrange: (room: Room) => startItem(room, VIDEO_A) },
        { case: "the playlist has ended", arrange: async (room: Room) => next(room, (await startItem(room, VIDEO_A)).playlist[0]) },
        { case: "the playlist is empty", arrange: async () => {} }
    ])("ignores a report without an itemId when $case", async ({ arrange }) => {
        // Arrange
        const room = await setupRoom(server.url);
        await arrange(room);
        const hostEvents: string[] = [];
        room.host.onAny(event => hostEvents.push(event));

        // Act: a client older than item ids reports the end of a video
        room.host.emit("playlist:next", { roomId: room.roomId });
        await chatBarrier(room.host, room.roomId);

        // Assert: neither the playlist nor the video moved
        expect(hostEvents).toEqual(["chat:sync"]);
    });
});


describe("playlist:select", () => {
    it("moves the current index to the selected video", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        await addItem(room, VIDEO_B);

        // Act
        const synced = await playlistSync(room, "playlist:select", { index: 1 });

        // Assert
        const expected = {
            eventId: 3,
            items: [item(VIDEO_A, room.hostUser), item(VIDEO_B, room.hostUser)],
            currentIndex: 1,
            isLooping: false
        };
        expect(synced).toEqual([expected, expected]);
    });
});


describe("eventId guard", () => {
    it("drops a stale eventId but applies payloads without one, as the frontend sends them", async () => {
        // Arrange: the server is at eventId 2
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        await addItem(room, VIDEO_B);

        // Act: a stale select, then a frontend-style add as the ordering barrier
        const synced = await collectBroadcast<PlaylistState>([room.host, room.guest], "playlist:sync", () => {
            room.host.emit("playlist:select", { roomId: room.roomId, index: 1, eventId: 1 });
            room.host.emit("playlist:add", { roomId: room.roomId, videoUrl: VIDEO_C, videoService: "youtube" });
        });

        // Assert: the first sync is the add, so the stale select changed nothing
        const expected = {
            eventId: 3,
            items: [item(VIDEO_A, room.hostUser), item(VIDEO_B, room.hostUser), item(VIDEO_C, room.hostUser)],
            currentIndex: 0,
            isLooping: false
        };
        expect(synced).toEqual([expected, expected]);
    });
});


describe("late join", () => {
    it("sends a late joiner the current playlist", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        const [queued] = await addItem(room, VIDEO_B);
        await next(room, queued);
        const lateJoiner = await connectClient(server.url);

        // Act
        const { playlist } = await joinRoom(lateJoiner, room.roomId, testUser("Late"), [room.host, room.guest]);

        // Assert
        expect(playlist).toEqual({
            eventId: 3,
            items: [item(VIDEO_A, room.hostUser), item(VIDEO_B, room.hostUser)],
            currentIndex: 1,
            isLooping: false
        });
    });
});
