import type { Socket } from "socket.io-client";
import type { PlaylistState, VideoState } from "@shared/interfaces/States";
import type User from "@shared/interfaces/User";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    addItem,
    chatBarrier,
    collectBroadcast,
    connectClient,
    createRoom,
    disconnectAll,
    joinRoom,
    NANOID_8,
    nextEvent,
    roomBarrier,
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

/** Selects `itemId` from the host and resolves with each member's playlist:sync and the video:sync that starts it */
async function select(room: Room, itemId: string) {
    const members: [Socket, Socket] = [room.host, room.guest];
    const video = Promise.all(members.map(member => nextEvent<VideoState>(member, "video:sync")));
    const playlist = await playlistSync(room, "playlist:select", { itemId });
    return { playlist, video: await video as [VideoState, VideoState] };
}

/** Records the names of every event `socket` receives from now on */
function recordEvents(socket: Socket): string[] {
    const events: string[] = [];
    socket.onAny(event => events.push(event));
    return events;
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

    it("keeps both of two adds sent at once, in the same order for every member", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        const hostSyncs: PlaylistState[] = [];
        const guestSyncs: PlaylistState[] = [];
        room.host.on("playlist:sync", (state: PlaylistState) => hostSyncs.push(state));
        room.guest.on("playlist:sync", (state: PlaylistState) => guestSyncs.push(state));

        // Act: both members add at once, frontend style
        room.host.emit("playlist:add", { roomId: room.roomId, videoUrl: VIDEO_B, videoService: "youtube" });
        room.guest.emit("playlist:add", { roomId: room.roomId, videoUrl: VIDEO_C, videoService: "youtube" });
        await roomBarrier(room.roomId, [room.host, room.guest]);

        // Assert: which add landed first isn't deterministic, so the items are compared as a set
        const final = hostSyncs.at(-1)!;
        expect(hostSyncs).toHaveLength(2);
        expect(guestSyncs).toEqual(hostSyncs);
        expect(final).toMatchObject({ eventId: 3, currentIndex: 0 });
        expect(final.items).toEqual(expect.arrayContaining([
            item(VIDEO_A, room.hostUser),
            item(VIDEO_B, room.hostUser),
            item(VIDEO_C, room.guestUser)
        ]));
    });

    it("restarts a re-added video that just ended as a new item, from 0s", async () => {
        // Arrange: A plays to the end of the playlist
        const room = await setupRoom(server.url);
        const { playlist: [started], video: [firstPlay] } = await startItem(room, VIDEO_A);
        await next(room, started);

        // Act
        const { playlist: [state], video: [replay] } = await startItem(room, VIDEO_A);

        // Assert
        expect(state).toMatchObject({ items: [{ videoUrl: VIDEO_A }, { videoUrl: VIDEO_A }], currentIndex: 1 });
        expect(replay).toMatchObject({ itemId: state.items[1]!.id, videoUrl: VIDEO_A, currentTime: 0, isPlaying: true });
        expect(replay.itemId).not.toBe(firstPlay.itemId);
    });

    it("records who added each item as they were then, so a rename doesn't rewrite earlier items", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A, room.guest);
        await collectBroadcast([room.host, room.guest], "user:updated", () => room.guest.emit("user:updated", { username: "Renamed" }));

        // Act
        const [state] = await addItem(room, VIDEO_B, room.guest);

        // Assert
        expect(state.items.map(entry => entry.addedBy)).toEqual([room.guestUser, { ...room.guestUser, username: "Renamed" }]);
    });

    it("drops an add from a socket that never joined", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        const outsider = await connectClient(server.url);
        const hostEvents = recordEvents(room.host);

        // Act: joining a room afterwards orders the outsider's traffic: the server has handled the add
        outsider.emit("playlist:add", { roomId: room.roomId, videoUrl: VIDEO_A, videoService: "youtube" });
        await joinRoom(outsider, await createRoom(server.url), testUser("Outsider"));
        await chatBarrier(room.host, room.roomId);

        // Assert
        expect(hostEvents).toEqual(["chat:sync"]);
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

    it("advances exactly once when every member reports that the same item ended", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        await addItem(room, VIDEO_B);
        const [queued] = await addItem(room, VIDEO_C);
        const hostEvents = recordEvents(room.host);
        const hostSyncs: PlaylistState[] = [];
        room.host.on("playlist:sync", (state: PlaylistState) => hostSyncs.push(state));

        // Act: both players reach the end of A, as they do when members are in sync
        const itemId = queued.items[0]!.id;
        room.host.emit("playlist:next", { roomId: room.roomId, itemId });
        room.guest.emit("playlist:next", { roomId: room.roomId, itemId });
        await roomBarrier(room.roomId, [room.host, room.guest]);

        // Assert: one advance, to B, which the server started once
        expect(hostEvents.filter(event => event !== "chat:sync")).toEqual(["playlist:sync", "video:sync"]);
        expect(hostSyncs.map(state => state.currentIndex)).toEqual([1]);
    });

    it("ignores a report for an item that is no longer the current one", async () => {
        // Arrange: A was playing, then B was selected
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        const [queued] = await addItem(room, VIDEO_B);
        await select(room, queued.items[1]!.id);
        const hostEvents = recordEvents(room.host);

        // Act: a late report that A ended
        room.host.emit("playlist:next", { roomId: room.roomId, itemId: queued.items[0]!.id });
        await chatBarrier(room.host, room.roomId);

        // Assert
        expect(hostEvents).toEqual(["chat:sync"]);
    });
});


describe("playlist:select", () => {
    it("moves the current index to the selected video", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        const [queued] = await addItem(room, VIDEO_B);

        // Act
        const synced = await playlistSync(room, "playlist:select", { itemId: queued.items[1]!.id });

        // Assert
        const expected = {
            eventId: 3,
            items: [item(VIDEO_A, room.hostUser), item(VIDEO_B, room.hostUser)],
            currentIndex: 1,
            isLooping: false
        };
        expect(synced).toEqual([expected, expected]);
    });

    it.each([
        { case: "the item already playing", payload: (ids: string[]) => ({ itemId: ids[0] }), ended: false },
        { case: "an unknown itemId", payload: () => ({ itemId: "no-such-item" }), ended: false },
        { case: "a non-string itemId", payload: () => ({ itemId: 1 }), ended: false },
        { case: "no itemId", payload: () => ({}), ended: false },
        { case: "an index in place of an itemId", payload: () => ({ index: 1 }), ended: false },
        { case: "an index of \"length\"", payload: () => ({ index: "length" }), ended: false },
        { case: "the last item once the playlist has ended", payload: (ids: string[]) => ({ itemId: ids[1] }), ended: true }
    ])("ignores selecting $case", async ({ payload, ended }) => {
        // Arrange: A is playing with B queued, or both have played to the end
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        const [queued] = await addItem(room, VIDEO_B);
        if (ended) await next(room, (await next(room, queued))[0]);
        const hostEvents = recordEvents(room.host);

        // Act
        room.host.emit("playlist:select", { roomId: room.roomId, ...payload(queued.items.map(entry => entry.id)) });
        await chatBarrier(room.host, room.roomId);

        // Assert
        expect(hostEvents).toEqual(["chat:sync"]);
    });

    it("starts an earlier item from 0s once the playlist has ended", async () => {
        // Arrange: A and B have played to the end
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        const [queued] = await addItem(room, VIDEO_B);
        await next(room, (await next(room, queued))[0]);

        // Act
        const { playlist: [state], video: started } = await select(room, queued.items[0]!.id);

        // Assert
        const expected = expect.objectContaining({ itemId: queued.items[0]!.id, videoUrl: VIDEO_A, currentTime: 0, isPlaying: true });
        expect(state.currentIndex).toBe(0);
        expect(started).toEqual([expected, expected]);
    });

    it("restarts a second copy of the playing URL as a different item", async () => {
        // Arrange: A is playing, and queued again
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        const [queued] = await addItem(room, VIDEO_A);

        // Act
        const { video: [restarted] } = await select(room, queued.items[1]!.id);

        // Assert
        expect(restarted).toMatchObject({ itemId: queued.items[1]!.id, videoUrl: VIDEO_A, currentTime: 0, isPlaying: true });
        expect(restarted.itemId).not.toBe(queued.items[0]!.id);
    });
});


describe("eventId on add and select", () => {
    it("applies an add that carries a stale eventId, since an add takes none", async () => {
        // Arrange: the server is at eventId 2
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        await addItem(room, VIDEO_B);

        // Act
        const [added] = await playlistSync(room, "playlist:add", { videoUrl: VIDEO_C, videoService: "youtube", eventId: 1 });

        // Assert
        expect(added).toMatchObject({ eventId: 3, items: [{ videoUrl: VIDEO_A }, { videoUrl: VIDEO_B }, { videoUrl: VIDEO_C }] });
    });

    it("applies a select that carries a stale eventId, since a select takes none", async () => {
        // Arrange: the server is at eventId 2
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_A);
        const [queued] = await addItem(room, VIDEO_B);

        // Act
        const [selected] = await playlistSync(room, "playlist:select", { itemId: queued.items[1]!.id, eventId: 1 });

        // Assert
        expect(selected).toMatchObject({ eventId: 3, currentIndex: 1 });
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
