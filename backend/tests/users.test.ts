import type { Socket } from "socket.io-client";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type User from "@shared/interfaces/User";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    chatBarrier,
    collectBroadcast,
    connectClient,
    createRoom,
    disconnectAll,
    joinRoom,
    nextEvent,
    setupRoom,
    startServer,
    testUser,
    type Room,
    type TestServer
} from "./helpers.js";


const LONGEST_ICON = `https://example.test/${"x".repeat(2048 - "https://example.test/".length)}`;

/** Emits user:updated from `sender` and resolves with the user:updated each member received */
function updateProfile(room: Room, sender: Socket, changes: object) {
    return collectBroadcast<User>([room.host, room.guest], "user:updated", () => sender.emit("user:updated", changes));
}

/** Sends a chat message from `sender` and resolves with each member's copy */
function say(room: Room, sender: Socket, msg: string) {
    return collectBroadcast<ChatMessage>([room.host, room.guest], "chat:sync", () =>
        sender.emit("chat:message", { roomId: room.roomId, msg }));
}


let server: TestServer;

beforeAll(async () => {
    server = await startServer();
});

afterEach(() => disconnectAll());

afterAll(() => server.close());


describe("user:updated", () => {
    it.each([
        { case: "a username, trimmed", changes: { username: "  Renamed  " }, applied: { username: "Renamed" } },
        { case: "a 40-character username", changes: { username: "x".repeat(40) }, applied: { username: "x".repeat(40) } },
        { case: "an https icon", changes: { icon: "https://example.test/new.png" }, applied: { icon: "https://example.test/new.png" } },
        { case: "an http icon", changes: { icon: "http://example.test/new.png" }, applied: { icon: "http://example.test/new.png" } },
        { case: "a 2048-character icon URL", changes: { icon: LONGEST_ICON }, applied: { icon: LONGEST_ICON } }
    ])("broadcasts $case to the room, keeping the rest of the profile", async ({ changes, applied }) => {
        // Arrange
        const room = await setupRoom(server.url);

        // Act
        const synced = await updateProfile(room, room.guest, changes);

        // Assert
        const expected = { ...room.guestUser, ...applied };
        expect(synced).toEqual([expected, expected]);
    });

    it.each([
        { case: "a blank username", changes: { username: "   " } },
        { case: "a username over 40 characters", changes: { username: "x".repeat(41) } },
        { case: "a username that isn't a string", changes: { username: 42 } },
        { case: "an icon that isn't an http(s) URL", changes: { icon: "javascript:alert(1)" } },
        { case: "an icon URL over 2048 characters", changes: { icon: `https://example.test/${"x".repeat(2048)}` } },
        { case: "an icon that isn't a string", changes: { icon: 42 } },
        { case: "a valid username with an invalid icon", changes: { username: "Valid", icon: "ftp://example.test/a.png" } },
        { case: "no changes", changes: {} }
    ])("rejects $case without telling anyone", async ({ changes }) => {
        // Arrange
        const room = await setupRoom(server.url);
        const guestEvents: string[] = [];
        room.guest.onAny(event => guestEvents.push(event));

        // Act
        room.guest.emit("user:updated", changes);
        const barrier = await chatBarrier(room.guest, room.roomId);

        // Assert: no update was sent, and the guest still sends as their original profile
        expect(guestEvents).toEqual(["chat:sync"]);
        expect(barrier.user).toEqual(room.guestUser);
    });

    it("shows the new name on new messages and to late joiners, while earlier messages keep the old one", async () => {
        // Arrange
        const room = await setupRoom(server.url);
        const [before] = await say(room, room.guest, "before rename");

        // Act
        await updateProfile(room, room.guest, { username: "Renamed" });
        const [after] = await say(room, room.guest, "after rename");
        const { users, chatHistory } = await joinRoom(await connectClient(server.url), room.roomId, testUser("Late"), [room.host, room.guest]);

        // Assert
        const renamed = { ...room.guestUser, username: "Renamed" };
        expect(before.user).toEqual(room.guestUser);
        expect(after.user).toEqual(renamed);
        expect(users[room.guestUser.id]).toEqual(renamed);
        expect(chatHistory.find(msg => msg.text === "before rename")?.user).toEqual(room.guestUser);
    });

    it("sends each room the update once, however many of the user's tabs are in it", async () => {
        // Arrange: the guest has two tabs in room A and one in room B, which also has its own member
        const roomA = await setupRoom(server.url);
        await joinRoom(await connectClient(server.url), roomA.roomId, roomA.guestUser);
        const roomB = await createRoom(server.url);
        const memberB = await connectClient(server.url);
        await joinRoom(memberB, roomB, testUser("MemberB"));
        await joinRoom(await connectClient(server.url), roomB, roomA.guestUser, [memberB]);
        const updates: Record<string, User[]> = { roomA: [], roomB: [] };
        roomA.host.on("user:updated", (user: User) => updates.roomA!.push(user));
        memberB.on("user:updated", (user: User) => updates.roomB!.push(user));

        // Act: once both rooms have an update, the barriers flush any duplicate sent with it
        const handled = Promise.all([nextEvent(roomA.host, "user:updated"), nextEvent(memberB, "user:updated")]);
        roomA.guest.emit("user:updated", { username: "Renamed" });
        await handled;
        await chatBarrier(roomA.host, roomA.roomId);
        await chatBarrier(memberB, roomB);

        // Assert
        const renamed = { ...roomA.guestUser, username: "Renamed" };
        expect(updates).toEqual({ roomA: [renamed], roomB: [renamed] });
    });
});
