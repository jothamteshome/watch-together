import type { Socket } from "socket.io-client";
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
    setupRoom,
    startItem,
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

    it("keeps the last 200 chat messages for late joiners", async () => {
        // Arrange: one member, whose join message is the first of 201 messages
        const roomId = await createRoom(server.url);
        const member = await connectClient(server.url);
        await joinRoom(member, roomId, testUser("Member"));
        const allEchoed = new Promise(resolve => member.on("chat:sync", (msg: ChatMessage) => {
            if (msg.text === "message 200") resolve(msg);
        }));
        for (let i = 1; i <= 200; i++) member.emit("chat:message", { roomId, msg: `message ${i}` });
        await allEchoed;

        // Act
        const { chatHistory } = await joinRoom(await connectClient(server.url), roomId, testUser("Late"), [member]);

        // Assert: the member's join and message 1 were dropped, and the late joiner's own join is last
        expect(chatHistory).toHaveLength(200);
        expect(chatHistory[0]?.text).toBe("message 2");
        expect(chatHistory.at(-1)).toMatchObject({ systemEvent: "joined", user: { username: "Late" } });
    });
});


describe("a member's second tab", () => {
    /** Ways a tab exits; each resolves once the server has handled it */
    const exits = {
        leaves: async (tab: Socket, roomId: string, user: User) => {
            tab.emit("room:leave", { roomId });
            // Joining another room orders the tab's traffic: the server has handled the leave
            await joinRoom(tab, await createRoom(server.url), user);
        },
        disconnects: async (tab: Socket) => {
            const serverSocket = server.io.of("/").sockets.get(tab.id!)!;
            const handled = new Promise(resolve => serverSocket.once("disconnect", resolve));
            tab.disconnect();
            await handled;
        }
    };

    it.each(["leaves", "disconnects"] as const)("joins and %s without announcing either", async (exit) => {
        // Arrange
        const room = await setupRoom(server.url);
        const secondTab = await connectClient(server.url);
        const hostEvents: string[] = [];
        room.host.onAny(event => hostEvents.push(event));

        // Act
        const snapshot = await joinRoom(secondTab, room.roomId, room.guestUser);
        await exits[exit](secondTab, room.roomId, room.guestUser);
        await chatBarrier(room.host, room.roomId);

        // Assert: the guest is still in the room through their first tab
        expect(hostEvents).toEqual(["chat:sync"]);
        expect(snapshot.users).toEqual({ [room.hostUser.id]: room.hostUser, [room.guestUser.id]: room.guestUser });
        expect(serverManager.serverRooms.get(room.roomId)?.getUsers()).toEqual(snapshot.users);
    });

    it("keeps the user in the room, unannounced, when their first tab leaves and the second stays", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        await joinRoom(await connectClient(server.url), room.roomId, room.guestUser);
        const hostEvents: string[] = [];
        room.host.onAny(event => hostEvents.push(event));

        // Act
        await exits.leaves(room.guest, room.roomId, room.guestUser);
        await chatBarrier(room.host, room.roomId);

        // Assert
        expect(hostEvents).toEqual(["chat:sync"]);
        expect(serverManager.serverRooms.get(room.roomId)?.hasUser(room.guestUser.id)).toBe(true);
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

    it("keeps an emptied room that is rejoined within the hour", async () => {
        // Arrange
        const roomId = await createRoom(server.url);
        const client = await connectClient(server.url);
        const user = testUser("Member");
        await joinRoom(client, roomId, user);
        // clearTimeout is faked too, or the rejoin's cancel can't clear the fake deletion timer
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldClearNativeTimers: true });
        client.emit("room:leave", { roomId });
        await vi.waitFor(() => expect(serverManager.serverRooms.get(roomId)?.getUserCount()).toBe(0));

        // Act
        await joinRoom(client, roomId, user);
        vi.advanceTimersByTime(60 * ONE_MINUTE);

        // Assert
        expect(serverManager.serverRooms.has(roomId)).toBe(true);
    });

    it("keeps a room when only one of its two members leaves", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        vi.useFakeTimers({ toFake: ["setTimeout"] });

        // Act
        room.guest.emit("room:leave", { roomId: room.roomId });
        await vi.waitFor(() => expect(serverManager.serverRooms.get(room.roomId)?.getUserCount()).toBe(1));
        vi.advanceTimersByTime(60 * ONE_MINUTE);

        // Assert
        expect(serverManager.serverRooms.has(room.roomId)).toBe(true);
    });

    it("sends a member who leaves and rejoins the room's current state, then its broadcasts again", async () => {
        // Arrange: a video is playing when the guest leaves
        const room = await setupRoom(server.url);
        await startItem(room, VIDEO_URL);
        const left = nextEvent(room.host, "user:left");
        room.guest.emit("room:leave", { roomId: room.roomId });
        await left;

        // Act
        const { video, playlist } = await joinRoom(room.guest, room.roomId, room.guestUser, [room.host]);
        const received = nextEvent<ChatMessage>(room.guest, "chat:sync");
        room.host.emit("chat:message", { roomId: room.roomId, msg: "welcome back" });

        // Assert
        expect(playlist).toMatchObject({ items: [{ videoUrl: VIDEO_URL }], currentIndex: 0 });
        expect(video).toMatchObject({ itemId: playlist!.items[0]!.id, videoUrl: VIDEO_URL, isPlaying: true });
        expect(await received).toMatchObject({ text: "welcome back", user: room.hostUser });
    });
});


describe("room creation", () => {
    it("deletes a room that nobody joins within an hour", async () => {
        // Arrange
        vi.useFakeTimers({ toFake: ["setTimeout"] });
        const roomId = await createRoom(server.url);

        // Act
        vi.advanceTimersByTime(60 * ONE_MINUTE);

        // Assert
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

    it("stops sending a socket its old room's broadcasts once it joins another room", async () => {
        // Arrange
        const roomA = await createRoom(server.url);
        const roomB = await createRoom(server.url);
        const memberA = await connectClient(server.url);
        const mover = await connectClient(server.url);
        const moverUser = testUser("Mover");
        await joinRoom(memberA, roomA, testUser("MemberA"));
        await joinRoom(mover, roomA, moverUser, [memberA]);
        const left = nextEvent<string>(memberA, "user:left");
        await joinRoom(mover, roomB, moverUser);
        const moverEvents: string[] = [];
        mover.onAny(event => moverEvents.push(event));

        // Act: room A's chat is handled before the mover's own barrier in room B
        await chatBarrier(memberA, roomA, "room A chat");
        await chatBarrier(mover, roomB);

        // Assert: the mover only hears room B, and room A announced and dropped them
        expect(moverEvents).toEqual(["chat:sync"]);
        expect(await left).toBe(moverUser.id);
        expect(serverManager.serverRooms.get(roomA)!.hasUser(moverUser.id)).toBe(false);
        expect(serverManager.serverRooms.get(roomB)!.hasUser(moverUser.id)).toBe(true);
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
        const left = nextEvent<string>(stayer, "user:left");

        // Act
        leaver.disconnect();
        await handled;
        await chatBarrier(stayer, roomId);

        // Assert
        expect(stayerChat[0]).toEqual(systemMessage("disconnected", leaverUser));
        expect(await left).toBe(leaverUser.id);
    });
});
