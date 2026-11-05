import type ChatMessage from "@shared/interfaces/ChatMessage";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { serverManager } from "../src/models/RoomManager.js";
import {
    chatBarrier,
    connectClient,
    createRoom,
    disconnectAll,
    joinedName,
    joinRoom,
    NANOID_8,
    nextEvent,
    startServer,
    type TestServer
} from "./helpers.js";


const VIDEO_URL = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
const ONE_MINUTE = 60 * 1000;

/** Expected chat:sync payload for a message sent by the server itself */
function systemMessage(text: unknown) {
    return {
        id: expect.stringMatching(NANOID_8),
        author: "[SYSTEM]",
        authorIcon: "https://api.dicebear.com/7.x/identicon/svg?seed=system",
        text,
        timestamp: expect.any(Number),
        isSystemMessage: true
    };
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


describe("REST /v1/rooms", () => {
    it("creates a room and serves its default video state", async () => {
        // Act
        const created = await fetch(`${server.url}/v1/rooms/create-room`, { method: "POST" });
        const { roomId } = await created.json() as { roomId: string };
        const room = await fetch(`${server.url}/v1/rooms/${roomId}`);
        const missing = await fetch(`${server.url}/v1/rooms/no-such-room`);

        // Assert
        expect(roomId).toMatch(NANOID_8);
        expect(room.status).toBe(200);
        expect(await room.json()).toEqual({
            eventId: 0,
            videoUrl: null,
            videoService: null,
            currentTime: 0,
            isPlaying: false,
            playbackRate: 1,
            lastUpdate: expect.any(Number)
        });
        expect(missing.status).toBe(404);
        expect(await missing.json()).toEqual({ error: "Room not found" });
    });
});


describe("room:join", () => {
    it("sends the joiner the room state, then a system join message", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const client = await connectClient(server.url);
        const events: string[] = [];
        client.onAny(event => events.push(event));

        // Act
        const { video, playlist, chat } = await joinRoom(client, roomId);

        // Assert
        expect(events).toEqual(["video:sync", "playlist:sync", "chat:sync"]);
        expect(video).toEqual({
            eventId: 0,
            videoUrl: null,
            videoService: null,
            currentTime: 0,
            isPlaying: false,
            playbackRate: 1,
            lastUpdate: expect.any(Number)
        });
        expect(playlist).toEqual({ eventId: 0, items: [], currentIndex: -1, isLooping: false });
        expect(chat).toEqual(systemMessage(expect.stringMatching(/^.+ has joined the room\.$/)));
    });

    it("announces a new member to existing members without resending them room state", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const host = await connectClient(server.url);
        const guest = await connectClient(server.url);
        await joinRoom(host, roomId);
        const hostEvents: string[] = [];
        host.onAny(event => hostEvents.push(event));

        // Act
        await joinRoom(guest, roomId, [host]);
        await chatBarrier(host, roomId);

        // Assert: the guest's join announcement, then the barrier
        expect(hostEvents).toEqual(["chat:sync", "chat:sync"]);
    });

    it("ignores a join for a room that does not exist", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const client = await connectClient(server.url);
        const events: string[] = [];
        client.onAny(event => events.push(event));

        // Act: the real join and chat barrier afterwards prove nothing was sent for the first one
        client.emit("room:join", { roomId: "no-such-room" });
        await joinRoom(client, roomId);
        await chatBarrier(client, roomId);

        // Assert
        expect(events).toEqual(["video:sync", "playlist:sync", "chat:sync", "chat:sync"]);
        expect(serverManager.serverRooms.has("no-such-room")).toBe(false);
    });
});


describe("room:leave", () => {
    it("announces a leaving member and stops sending them room broadcasts", async () => {
        // Arrange: the leaver also sits alone in a second room, used as its ordering barrier.
        // That room is joined first because every join regenerates the username.
        const roomId = await createRoom(server.url);
        const leaverOnlyRoom = await createRoom(server.url);
        const stayer = await connectClient(server.url);
        const leaver = await connectClient(server.url);
        await joinRoom(stayer, roomId);
        await joinRoom(leaver, leaverOnlyRoom);
        const { chat: leaverJoin } = await joinRoom(leaver, roomId, [stayer]);
        const leaverChat: string[] = [];
        leaver.on("chat:sync", (msg: ChatMessage) => leaverChat.push(msg.text));

        // Act
        const announced = nextEvent<ChatMessage>(stayer, "chat:sync");
        leaver.emit("room:leave", { roomId });
        const leaveMessage = await announced;
        await chatBarrier(stayer, roomId, "after leave");
        await chatBarrier(leaver, leaverOnlyRoom, "leaver barrier");

        // Assert
        expect(leaveMessage).toEqual(systemMessage(`${joinedName(leaverJoin)} has left the room.`));
        expect(leaverChat).toEqual(["leaver barrier"]);
    });

    it("keeps an emptied room for an hour before deleting it", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const client = await connectClient(server.url);
        await joinRoom(client, roomId);
        vi.useFakeTimers({ toFake: ["setTimeout"] });

        // Act
        client.emit("room:leave", { roomId });
        await vi.waitFor(() => expect(serverManager.serverRooms.get(roomId)?.getUsers().size).toBe(0));

        // Assert
        vi.advanceTimersByTime(59 * ONE_MINUTE);
        expect(serverManager.serverRooms.has(roomId)).toBe(true);
        vi.advanceTimersByTime(ONE_MINUTE);
        expect(serverManager.serverRooms.has(roomId)).toBe(false);
    });
});


describe("room isolation", () => {
    it("keeps video and chat broadcasts inside the room they were sent to", async () => {
        // Arrange
        const roomA = await createRoom(server.url);
        const roomB = await createRoom(server.url);
        const memberA = await connectClient(server.url);
        const memberB = await connectClient(server.url);
        await joinRoom(memberA, roomA);
        await joinRoom(memberB, roomB);
        const memberBEvents: string[] = [];
        memberB.onAny(event => memberBEvents.push(event));

        // Act
        const videoSynced = nextEvent(memberA, "video:sync");
        memberA.emit("video:set", { roomId: roomA, videoUrl: VIDEO_URL, videoService: "youtube" });
        await videoSynced;
        await chatBarrier(memberA, roomA, "room A chat");
        await chatBarrier(memberB, roomB);

        // Assert: only room B's own barrier reached member B
        expect(memberBEvents).toEqual(["chat:sync"]);
    });
});


describe("disconnect", () => {
    // Known bug: disconnect() iterates Object.keys() of the serverRooms Map, which is always
    // empty, so no room is notified. This asserts the intended behaviour; remove .fails once fixed.
    it.fails("announces a disconnected member to the room", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const stayer = await connectClient(server.url);
        const leaver = await connectClient(server.url);
        await joinRoom(stayer, roomId);
        const { chat: leaverJoin } = await joinRoom(leaver, roomId, [stayer]);
        const serverSocket = server.io.of("/").sockets.get(leaver.id!)!;
        const handled = new Promise(resolve => serverSocket.once("disconnect", resolve));
        const stayerChat: ChatMessage[] = [];
        stayer.on("chat:sync", (msg: ChatMessage) => stayerChat.push(msg));

        // Act
        leaver.disconnect();
        await handled;
        await chatBarrier(stayer, roomId);

        // Assert
        expect(stayerChat[0]).toEqual(systemMessage(`${joinedName(leaverJoin)} has disconnected from the room.`));
    });
});
