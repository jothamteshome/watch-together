import type ChatMessage from "@shared/interfaces/ChatMessage";
import type User from "@shared/interfaces/User";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { serverManager } from "../src/models/RoomManager.js";
import {
    chatBarrier,
    connectClient,
    createRoom,
    disconnectAll,
    joinRoom,
    NANOID_8,
    nextEvent,
    startServer,
    testUser,
    type TestServer
} from "./helpers.js";


const VIDEO_URL = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
const ONE_MINUTE = 60 * 1000;

/** Expected chat:sync payload for the server's announcement about `user` */
function systemMessage(systemEvent: NonNullable<ChatMessage["systemEvent"]>, user: User) {
    return {
        id: expect.stringMatching(NANOID_8),
        user,
        timestamp: expect.any(Number),
        systemEvent
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
            itemId: null,
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
    it("sends the joiner one snapshot of the room, including its own join message", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const client = await connectClient(server.url);
        const user = testUser("Joiner");
        const events: string[] = [];
        client.onAny(event => events.push(event));

        // Act
        const snapshot = await joinRoom(client, roomId, user);

        // Assert
        expect(events).toEqual(["room:sync"]);
        expect(snapshot).toEqual({
            users: { [user.id]: user },
            chatHistory: [systemMessage("joined", user)],
            video: {
                eventId: 0,
                itemId: null,
                videoUrl: null,
                videoService: null,
                currentTime: 0,
                isPlaying: false,
                playbackRate: 1,
                lastUpdate: expect.any(Number)
            },
            playlist: { eventId: 0, items: [], currentIndex: -1, isLooping: false }
        });
    });

    it("announces a new member to existing members without resending them room state", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const host = await connectClient(server.url);
        const guest = await connectClient(server.url);
        await joinRoom(host, roomId, testUser("Host"));
        const hostEvents: string[] = [];
        host.onAny(event => hostEvents.push(event));

        // Act
        await joinRoom(guest, roomId, testUser("Guest"), [host]);
        await chatBarrier(host, roomId);

        // Assert: the guest's join announcement, then the barrier
        expect(hostEvents).toEqual(["chat:sync", "user:joined", "chat:sync"]);
    });

    it("ignores a join for a room that does not exist", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const client = await connectClient(server.url);
        const user = testUser("Joiner");
        const events: string[] = [];
        client.onAny(event => events.push(event));

        // Act: the real join and chat barrier afterwards prove nothing was sent for the first one
        client.emit("room:join", { roomId: "no-such-room", user });
        await joinRoom(client, roomId, user);
        await chatBarrier(client, roomId);

        // Assert
        expect(events).toEqual(["room:sync", "chat:sync"]);
        expect(serverManager.serverRooms.has("no-such-room")).toBe(false);
    });
});


describe("room:leave", () => {
    it("announces a leaving member and stops sending them room broadcasts", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const stayer = await connectClient(server.url);
        const leaver = await connectClient(server.url);
        const leaverUser = testUser("Leaver");
        await joinRoom(stayer, roomId, testUser("Stayer"));
        await joinRoom(leaver, roomId, leaverUser, [stayer]);
        const leaverChat: ChatMessage[] = [];
        leaver.on("chat:sync", (msg: ChatMessage) => leaverChat.push(msg));

        // Act
        const announced = Promise.all([nextEvent<ChatMessage>(stayer, "chat:sync"), nextEvent<string>(stayer, "user:left")]);
        leaver.emit("room:leave", { roomId });
        const [leaveMessage, leftUserId] = await announced;
        await chatBarrier(stayer, roomId, "after leave");
        // Joining another room orders the leaver's own traffic: anything sent to it before arrives first
        await joinRoom(leaver, await createRoom(server.url), leaverUser);

        // Assert
        expect(leaveMessage).toEqual(systemMessage("left", leaverUser));
        expect(leftUserId).toBe(leaverUser.id);
        expect(leaverChat).toEqual([]);
    });

    it("keeps an emptied room for an hour before deleting it", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const client = await connectClient(server.url);
        await joinRoom(client, roomId, testUser("Member"));
        vi.useFakeTimers({ toFake: ["setTimeout"] });

        // Act
        client.emit("room:leave", { roomId });
        await vi.waitFor(() => expect(serverManager.serverRooms.get(roomId)?.getUserCount()).toBe(0));

        // Assert
        vi.advanceTimersByTime(59 * ONE_MINUTE);
        expect(serverManager.serverRooms.has(roomId)).toBe(true);
        vi.advanceTimersByTime(ONE_MINUTE);
        expect(serverManager.serverRooms.has(roomId)).toBe(false);
    });
});


describe("room isolation", () => {
    it("keeps playlist, video and chat broadcasts inside the room they were sent to", async () => {
        // Arrange
        const roomA = await createRoom(server.url);
        const roomB = await createRoom(server.url);
        const memberA = await connectClient(server.url);
        const memberB = await connectClient(server.url);
        await joinRoom(memberA, roomA, testUser("MemberA"));
        await joinRoom(memberB, roomB, testUser("MemberB"));
        const memberBEvents: string[] = [];
        memberB.onAny(event => memberBEvents.push(event));

        // Act: the add broadcasts playlist:sync, then the video:sync that starts it
        const videoSynced = nextEvent(memberA, "video:sync");
        memberA.emit("playlist:add", { roomId: roomA, videoUrl: VIDEO_URL, videoService: "youtube" });
        await videoSynced;
        await chatBarrier(memberA, roomA, "room A chat");
        await chatBarrier(memberB, roomB);

        // Assert: only room B's own barrier reached member B
        expect(memberBEvents).toEqual(["chat:sync"]);
    });
});


describe("disconnect", () => {
    it("announces a disconnected member to the room", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const stayer = await connectClient(server.url);
        const leaver = await connectClient(server.url);
        const leaverUser = testUser("Leaver");
        await joinRoom(stayer, roomId, testUser("Stayer"));
        await joinRoom(leaver, roomId, leaverUser, [stayer]);
        const serverSocket = server.io.of("/").sockets.get(leaver.id!)!;
        const handled = new Promise(resolve => serverSocket.once("disconnect", resolve));
        const stayerChat: ChatMessage[] = [];
        stayer.on("chat:sync", (msg: ChatMessage) => stayerChat.push(msg));

        // Act
        leaver.disconnect();
        await handled;
        await chatBarrier(stayer, roomId);

        // Assert
        expect(stayerChat[0]).toEqual(systemMessage("disconnected", leaverUser));
    });
});
