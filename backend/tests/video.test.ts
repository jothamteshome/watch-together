import type { Socket } from "socket.io-client";
import type { VideoState } from "@shared/interfaces/States";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
    addItem,
    collectBroadcast,
    connectClient,
    disconnectAll,
    joinRoom,
    NANOID_8,
    roomBarrier,
    setupRoom,
    startItem,
    startServer,
    testUser,
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

/** Queues FIRST_URL into the empty playlist, which the server starts, and returns the started state */
async function startVideo(room: Room): Promise<VideoState> {
    const { video: [current] } = await startItem(room, FIRST_URL);
    return current;
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


describe("starting a playlist item", () => {
    it("starts the first video queued from 0s, for every member", async () => {
        // Arrange
        const room = await setupRoom(server.url);

        // Act
        const { playlist: [playlist], video: synced } = await startItem(room, FIRST_URL);

        // Assert
        const expected = {
            eventId: 1,
            itemId: playlist.items[0]!.id,
            videoUrl: FIRST_URL,
            videoService: "youtube",
            currentTime: 0,
            isPlaying: true,
            playbackRate: 1,
            lastUpdate: expect.any(Number)
        };
        expect(synced).toEqual([expected, expected]);
    });

    it("restarts playback for every member when another item is selected", async () => {
        // Arrange: a paused video, part way in, at double speed
        const room = await setupRoom(server.url);
        const first = await startVideo(room);
        await addItem(room, SECOND_URL);
        const [paused] = await videoSync(room, room.host, "video:pause", { time: 30, playbackRate: 2, eventId: first.eventId });

        // Act
        const synced = await videoSync(room, room.guest, "playlist:select", { index: 1 });

        // Assert
        const expected = {
            eventId: paused.eventId + 1,
            itemId: expect.stringMatching(NANOID_8),
            videoUrl: SECOND_URL,
            videoService: "youtube",
            currentTime: 0,
            isPlaying: true,
            playbackRate: 1,
            lastUpdate: expect.any(Number)
        };
        expect(synced).toEqual([expected, expected]);
        expect(synced[0].itemId).not.toBe(first.itemId);
    });
});


describe("video:play / video:pause / video:seek / video:playbackrate", () => {
    it.each([
        { event: "video:play", wasPlaying: false, isPlaying: true },
        { event: "video:pause", wasPlaying: true, isPlaying: false },
        { event: "video:seek", wasPlaying: true, isPlaying: true },
        { event: "video:playbackrate", wasPlaying: false, isPlaying: false }
    ])("$event at the current eventId applies time and rate (isPlaying $wasPlaying -> $isPlaying)", async ({ event, wasPlaying, isPlaying }) => {
        // Arrange: a started item is playing
        const room = await setupRoom(server.url);
        let current = await startVideo(room);
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
        const current = await startVideo(room);

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

    it("applies only the first of two conflicting events, so every member ends in the same state", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        const current = await startVideo(room);
        const hostSyncs: VideoState[] = [];
        const guestSyncs: VideoState[] = [];
        room.host.on("video:sync", (state: VideoState) => hostSyncs.push(state));
        room.guest.on("video:sync", (state: VideoState) => guestSyncs.push(state));

        // Act: the host plays and the guest pauses, both against the same state
        room.host.emit("video:play", { roomId: room.roomId, time: 20, playbackRate: 1, eventId: current.eventId });
        room.guest.emit("video:pause", { roomId: room.roomId, time: 25, playbackRate: 1, eventId: current.eventId });
        await roomBarrier(room.roomId, [room.host, room.guest]);

        // Assert
        expect(hostSyncs).toHaveLength(1);
        expect(guestSyncs).toEqual(hostSyncs);
        expect(hostSyncs[0]?.eventId).toBe(current.eventId + 1);
    });

    it("drops a seek made against the video that was playing before a select", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        const first = await startVideo(room);
        await addItem(room, SECOND_URL);
        const [selected] = await videoSync(room, room.host, "playlist:select", { index: 1 });

        // Act: a seek built on the first video's state, then a current pause as the ordering barrier
        const synced = await collectBroadcast<VideoState>([room.host, room.guest], "video:sync", () => {
            room.guest.emit("video:seek", { roomId: room.roomId, time: 99, playbackRate: 1, eventId: first.eventId });
            room.guest.emit("video:pause", { roomId: room.roomId, time: 5, playbackRate: 1, eventId: selected.eventId });
        });

        // Assert: the first sync is the pause, so the stale seek changed nothing
        const expected = expect.objectContaining({ itemId: selected.itemId, eventId: selected.eventId + 1, currentTime: 5, isPlaying: false });
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
        const current = await startVideo(room);
        await videoSync(room, room.host, event, { time: 10, playbackRate: 1, eventId: current.eventId });
        vi.setSystemTime(T0 + 5000);
        const lateJoiner = await connectClient(server.url);

        // Act
        const { video } = await joinRoom(lateJoiner, room.roomId, testUser("Late"), [room.host, room.guest]);

        // Assert
        expect(video).toMatchObject({ itemId: current.itemId, videoUrl: FIRST_URL, currentTime, isPlaying, lastUpdate: T0 + 5000 });
    });

    it("projects each of several late joiners from the room's state, without compounding the elapsed time", async () => {
        // Arrange: playing from 10s at T0
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(T0);
        const room = await setupRoom(server.url);
        const current = await startVideo(room);
        await videoSync(room, room.host, "video:play", { time: 10, playbackRate: 1, eventId: current.eventId });
        const firstJoiner = await connectClient(server.url);
        const secondJoiner = await connectClient(server.url);

        // Act
        vi.setSystemTime(T0 + 5000);
        const first = await joinRoom(firstJoiner, room.roomId, testUser("First"), [room.host, room.guest]);
        vi.setSystemTime(T0 + 8000);
        const second = await joinRoom(secondJoiner, room.roomId, testUser("Second"), [room.host, room.guest, firstJoiner]);

        // Assert
        expect(first.video?.currentTime).toBe(15);
        expect(second.video?.currentTime).toBe(18);
    });
});
