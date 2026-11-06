import type { PlaylistState } from "@shared/interfaces/States";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    collectBroadcast,
    connectClient,
    disconnectAll,
    joinRoom,
    setupRoom,
    startServer,
    type Room,
    type TestServer
} from "./helpers.js";


const VIDEO_A = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
const VIDEO_B = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
const VIDEO_C = "https://www.youtube.com/watch?v=ccccccccccc";

/** Emits a playlist event from the host as the frontend does (no eventId) and resolves with each member's playlist:sync */
function playlistSync(room: Room, event: string, payload: object = {}) {
    return collectBroadcast<PlaylistState>([room.host, room.guest], "playlist:sync", () =>
        room.host.emit(event, { roomId: room.roomId, ...payload }));
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
        const synced = await playlistSync(room, "playlist:add", { videoUrl: VIDEO_A });

        // Assert
        const expected = { eventId: 1, items: [VIDEO_A], currentIndex: 0, isLooping: false };
        expect(synced).toEqual([expected, expected]);
    });

    it("appends later videos without moving the current index", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await playlistSync(room, "playlist:add", { videoUrl: VIDEO_A });

        // Act
        const [state] = await playlistSync(room, "playlist:add", { videoUrl: VIDEO_B });

        // Assert
        expect(state).toEqual({ eventId: 2, items: [VIDEO_A, VIDEO_B], currentIndex: 0, isLooping: false });
    });

    it("selects a video added after the playlist has ended", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await playlistSync(room, "playlist:add", { videoUrl: VIDEO_A });
        await playlistSync(room, "playlist:next");

        // Act
        const [state] = await playlistSync(room, "playlist:add", { videoUrl: VIDEO_B });

        // Assert
        expect(state).toEqual({ eventId: 3, items: [VIDEO_A, VIDEO_B], currentIndex: 1, isLooping: false });
    });
});


describe("playlist:next", () => {
    it("advances one item at a time, then ends at -1 and stays there", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await playlistSync(room, "playlist:add", { videoUrl: VIDEO_A });
        await playlistSync(room, "playlist:add", { videoUrl: VIDEO_B });

        // Act
        const [second] = await playlistSync(room, "playlist:next");
        const [ended] = await playlistSync(room, "playlist:next");
        const [stillEnded] = await playlistSync(room, "playlist:next");

        // Assert
        expect(second).toEqual({ eventId: 3, items: [VIDEO_A, VIDEO_B], currentIndex: 1, isLooping: false });
        expect(ended).toEqual({ eventId: 4, items: [VIDEO_A, VIDEO_B], currentIndex: -1, isLooping: false });
        expect(stillEnded).toEqual({ eventId: 5, items: [VIDEO_A, VIDEO_B], currentIndex: -1, isLooping: false });
    });
});


describe("playlist:select", () => {
    it("moves the current index to the selected video", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await playlistSync(room, "playlist:add", { videoUrl: VIDEO_A });
        await playlistSync(room, "playlist:add", { videoUrl: VIDEO_B });

        // Act
        const synced = await playlistSync(room, "playlist:select", { index: 1 });

        // Assert
        const expected = { eventId: 3, items: [VIDEO_A, VIDEO_B], currentIndex: 1, isLooping: false };
        expect(synced).toEqual([expected, expected]);
    });
});


describe("eventId guard", () => {
    it("drops a stale eventId but applies payloads without one, as the frontend sends them", async () => {
        // Arrange: the server is at eventId 2
        const room = await setupRoom(server.url);
        await playlistSync(room, "playlist:add", { videoUrl: VIDEO_A });
        await playlistSync(room, "playlist:add", { videoUrl: VIDEO_B });

        // Act: a stale select, then a frontend-style add as the ordering barrier
        const synced = await collectBroadcast<PlaylistState>([room.host, room.guest], "playlist:sync", () => {
            room.host.emit("playlist:select", { roomId: room.roomId, index: 1, eventId: 1 });
            room.host.emit("playlist:add", { roomId: room.roomId, videoUrl: VIDEO_C });
        });

        // Assert: the first sync is the add, so the stale select changed nothing
        const expected = { eventId: 3, items: [VIDEO_A, VIDEO_B, VIDEO_C], currentIndex: 0, isLooping: false };
        expect(synced).toEqual([expected, expected]);
    });
});


describe("late join", () => {
    it("sends a late joiner the current playlist", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await playlistSync(room, "playlist:add", { videoUrl: VIDEO_A });
        await playlistSync(room, "playlist:add", { videoUrl: VIDEO_B });
        await playlistSync(room, "playlist:next");
        const lateJoiner = await connectClient(server.url);

        // Act
        const { playlist } = await joinRoom(lateJoiner, room.roomId, [room.host, room.guest]);

        // Assert
        expect(playlist).toEqual({ eventId: 3, items: [VIDEO_A, VIDEO_B], currentIndex: 1, isLooping: false });
    });
});
