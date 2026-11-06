import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type User from "@shared/interfaces/User";
import { afterEach, describe, expect, it } from "vitest";
import { serverManager } from "../src/models/RoomManager.js";


const USER: User = { id: "unit-user", username: "Unit", icon: "https://example.test/unit.png" };

afterEach(() => {
    serverManager.serverRooms.clear();
    serverManager.disconnectSocket("socket-1");
    serverManager.disconnectSocket("socket-2");
});


describe("createRoom", () => {
    it("gives each room its own video and playlist state", () => {
        // Arrange
        serverManager.createRoom("room-a");
        serverManager.createRoom("room-b");
        const roomA = serverManager.serverRooms.get("room-a")!;
        const item: PlaylistItem = { id: "item-1", videoUrl: "https://www.youtube.com/watch?v=aaaaaaaaaaa", videoService: "youtube", addedBy: USER };

        // Act: queueing into room A starts its video, and a seek moves it on
        roomA.addPlaylistItem(0, item);
        roomA.updateVideo(1, 99, 1, true);

        // Assert
        expect(roomA.getVideoState()).toMatchObject({ currentTime: 99, isPlaying: true });
        const roomB = serverManager.serverRooms.get("room-b")!;
        expect(roomB.getVideoState()).toMatchObject({ eventId: 0, itemId: null, currentTime: 0, isPlaying: false });
        expect(roomB.getPlaylistState().items).toEqual([]);
    });
});


describe("disconnectSocket", () => {
    it("keeps a user's profile until their last socket disconnects", () => {
        // Arrange: one user, two tabs
        serverManager.registerConnection("socket-1", USER);
        serverManager.registerConnection("socket-2", USER);

        // Act
        serverManager.disconnectSocket("socket-1");
        const afterFirstTab = serverManager.getUserBySocket("socket-2");
        serverManager.disconnectSocket("socket-2");

        // Assert
        expect(afterFirstTab).toEqual(USER);
        expect(serverManager.getUserBySocket("socket-1")).toBeUndefined();
        expect(serverManager.serverUsers.has(USER.id)).toBe(false);
        expect(serverManager.userSockets.has(USER.id)).toBe(false);
    });
});


describe("updateUser", () => {
    it("stores a new profile instead of editing the one earlier messages still reference", () => {
        // Arrange
        const sent: User = { ...USER };
        serverManager.registerConnection("socket-1", sent);

        // Act
        const updated = serverManager.updateUser("socket-1", { username: "Renamed" });

        // Assert
        expect(updated).toEqual({ ...USER, username: "Renamed" });
        expect(serverManager.getUserBySocket("socket-1")).toBe(updated);
        expect(sent.username).toBe("Unit");
    });
});
