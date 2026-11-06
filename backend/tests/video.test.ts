import type { Socket } from "socket.io-client";
import type { VideoState } from "@shared/interfaces/States";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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


const FIRST_URL = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
const SECOND_URL = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
const T0 = Date.UTC(2026, 0, 1);

/** Emits `event` from `sender` and resolves with the video:sync each member received */
function videoSync(room: Room, sender: Socket, event: string, payload: object) {
    return collectBroadcast<VideoState>([room.host, room.guest], "video:sync", () =>
        sender.emit(event, { roomId: room.roomId, ...payload }));
}


let server: TestServer;

beforeAll(async () => {
    server = await startServer();
});

afterEach(() => {
    disconnectAll();
    vi.useRealTimers();
});

afterAll(() => server.close());


describe("video:set", () => {
    it("broadcasts a new video that restarts playback, to every member", async () => {
        // Arrange: a paused video, part way in, at double speed
        const room = await setupRoom(server.url);
        const [first] = await videoSync(room, room.host, "video:set", { videoUrl: FIRST_URL, videoService: "youtube" });
        const [paused] = await videoSync(room, room.host, "video:pause", { time: 30, playbackRate: 2, eventId: first.eventId });

        // Act
        const synced = await videoSync(room, room.guest, "video:set", { videoUrl: SECOND_URL, videoService: "youtube" });

        // Assert
        const expected = {
            eventId: paused.eventId + 1,
            videoUrl: SECOND_URL,
            videoService: "youtube",
            currentTime: 0,
            isPlaying: true,
            playbackRate: 1,
            lastUpdate: expect.any(Number)
        };
        expect(synced).toEqual([expected, expected]);
    });

    it("stores a missing videoService as null", async () => {
        // Arrange
        const room = await setupRoom(server.url);

        // Act
        const [state] = await videoSync(room, room.host, "video:set", { videoUrl: FIRST_URL });

        // Assert
        expect(state.videoService).toBeNull();
    });
});


describe("video:play / video:pause / video:seek / video:playbackrate", () => {
    it.each([
        { event: "video:play", wasPlaying: false, isPlaying: true },
        { event: "video:pause", wasPlaying: true, isPlaying: false },
        { event: "video:seek", wasPlaying: true, isPlaying: true },
        { event: "video:playbackrate", wasPlaying: false, isPlaying: false }
    ])("$event at the current eventId applies time and rate (isPlaying $wasPlaying -> $isPlaying)", async ({ event, wasPlaying, isPlaying }) => {
        // Arrange: video:set leaves the video playing
        const room = await setupRoom(server.url);
        let [current] = await videoSync(room, room.host, "video:set", { videoUrl: FIRST_URL, videoService: "youtube" });
        if (!wasPlaying) {
            [current] = await videoSync(room, room.host, "video:pause", { time: 0, playbackRate: 1, eventId: current.eventId });
        }

        // Act
        const synced = await videoSync(room, room.guest, event, { time: 42.5, playbackRate: 1.5, eventId: current.eventId });

        // Assert
        const expected = {
            ...current,
            eventId: current.eventId + 1,
            currentTime: 42.5,
            playbackRate: 1.5,
            isPlaying,
            lastUpdate: expect.any(Number)
        };
        expect(synced).toEqual([expected, expected]);
    });

    it("drops an event whose eventId is behind the server", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        const [current] = await videoSync(room, room.host, "video:set", { videoUrl: FIRST_URL, videoService: "youtube" });

        // Act: a stale play, then a current pause as the ordering barrier
        const synced = await collectBroadcast<VideoState>([room.host, room.guest], "video:sync", () => {
            room.guest.emit("video:play", { roomId: room.roomId, time: 99, playbackRate: 2, eventId: current.eventId - 1 });
            room.guest.emit("video:pause", { roomId: room.roomId, time: 10, playbackRate: 1, eventId: current.eventId });
        });

        // Assert: the first sync is the pause, so the stale play changed nothing
        const expected = {
            ...current,
            eventId: current.eventId + 1,
            currentTime: 10,
            playbackRate: 1,
            isPlaying: false,
            lastUpdate: expect.any(Number)
        };
        expect(synced).toEqual([expected, expected]);
    });
});


describe("late join", () => {
    it.each([
        { event: "video:play", isPlaying: true, currentTime: 15 },
        { event: "video:pause", isPlaying: false, currentTime: 10 }
    ])("after $event at 10s and 5s of wall time, a late joiner gets currentTime $currentTime", async ({ event, isPlaying, currentTime }) => {
        // Arrange
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(T0);
        const room = await setupRoom(server.url);
        const [current] = await videoSync(room, room.host, "video:set", { videoUrl: FIRST_URL, videoService: "youtube" });
        await videoSync(room, room.host, event, { time: 10, playbackRate: 1, eventId: current.eventId });
        vi.setSystemTime(T0 + 5000);
        const lateJoiner = await connectClient(server.url);

        // Act
        const { video } = await joinRoom(lateJoiner, room.roomId, [room.host, room.guest]);

        // Assert
        expect(video).toMatchObject({ videoUrl: FIRST_URL, currentTime, isPlaying, lastUpdate: T0 + 5000 });
    });
});
