import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoState } from "@shared/interfaces/States";
import type { VideoService } from "@shared/interfaces/VideoService";
import RoomManager from "../../src/managers/RoomManager";
import { socket } from "../support/fakeSocket";
import { FakePlayer, installYoutube, latestPlayer, PlayerState } from "../support/fakeYoutube";
import {
    BACKEND_URL,
    chatMessage,
    OTHER_USER,
    playlistItem,
    playlistState,
    ROOM_ID,
    roomSnapshot,
    seedProfile,
    SELF_USER,
    stubFetch,
    UNSUPPORTED_URL,
    VIDEO_A,
    VIDEO_B,
    videoInfo,
    videoState
} from "../support/helpers";

vi.mock("../../src/services/socket", () => import("../support/fakeSocket"));


/** Creates a manager for ROOM_ID; it joins once SELF_USER's stored profile has resolved, asynchronously */
function newManager({ connected = true } = {}) {
    socket.connected = connected;
    seedProfile();
    const callbacks = {
        onVideoChange: vi.fn(),
        updatePlaylistUI: vi.fn(),
        updateChatUI: vi.fn(),
        updateSelfUserUI: vi.fn(),
        updateUsersUI: vi.fn()
    };
    const manager = new RoomManager(
        ROOM_ID,
        callbacks.onVideoChange,
        callbacks.updatePlaylistUI,
        callbacks.updateChatUI,
        callbacks.updateSelfUserUI,
        callbacks.updateUsersUI
    );
    return { manager, ...callbacks };
}


/** Creates a manager and waits until it has its profile and has joined, or connected to join */
async function createManager(options: { connected?: boolean } = {}) {
    const created = newManager(options);
    await vi.waitFor(() => expect(created.updateSelfUserUI).toHaveBeenCalledOnce());
    return created;
}


/** Delivers a video:sync and, for the first one, fires the player's onReady as the iframe API would */
async function receiveVideo(state: VideoState) {
    const isFirst = FakePlayer.instances.length === 0;
    const synced = socket.receive("video:sync", state);
    if (isFirst) latestPlayer().ready();
    await synced;
}


let alertSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    // monitorPlaybackRate starts a 200ms interval nothing ever clears; fake timers contain it
    vi.useFakeTimers();
    installYoutube();
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
});


describe("joining", () => {
    it("loads the snapshot's video at the room's time without sending anything", async () => {
        // Arrange: the room's video is 30s in, and the iframe API isn't ready yet
        await createManager();
        socket.emit.mockClear();

        // Act
        await socket.receive("room:sync", roomSnapshot({
            video: videoState({ currentTime: 30, eventId: 4 }),
            playlist: playlistState({ eventId: 1 })
        }));
        latestPlayer().ready();

        // Assert
        await vi.waitFor(() => expect(latestPlayer().loadVideoById).toHaveBeenCalledExactlyOnceWith("aaaaaaaaaaa", 30));
        expect(socket.emit).not.toHaveBeenCalled();
    });

    it("connects a disconnected socket and joins only once it's connected", async () => {
        // Arrange
        await createManager({ connected: false });
        const joinsBeforeConnect = socket.emitted("room:join").length;

        // Act
        await socket.receive("connect");

        // Assert
        expect(socket.connect).toHaveBeenCalledOnce();
        expect(joinsBeforeConnect).toBe(0);
        expect(socket.emitted("room:join")).toEqual([{ roomId: ROOM_ID, user: SELF_USER }]);
    });

    it("joins straight away on an already-connected socket, as the stored profile", async () => {
        // Arrange + Act
        const { updateSelfUserUI } = await createManager({ connected: true });

        // Assert
        expect(socket.connect).not.toHaveBeenCalled();
        expect(socket.emitted("room:join")).toEqual([{ roomId: ROOM_ID, user: SELF_USER }]);
        expect(updateSelfUserUI).toHaveBeenCalledExactlyOnceWith(SELF_USER);
    });

    it("doesn't join from a manager destroyed before the socket connects (StrictMode remount)", async () => {
        // Arrange: StrictMode mounts, unmounts and remounts the room before the socket connects
        const { manager } = await createManager({ connected: false });
        manager.destroy();
        await createManager({ connected: false });

        // Act
        await socket.receive("connect");

        // Assert
        expect(socket.emitted("room:join")).toEqual([{ roomId: ROOM_ID, user: SELF_USER }]);
    });

    it("doesn't join from a manager destroyed before its profile resolved", async () => {
        // Arrange: the unmount comes straight after the mount, before the profile is read
        const { manager, updateSelfUserUI } = newManager();
        manager.destroy();

        // Act
        await createManager();

        // Assert
        expect(socket.emitted("room:join")).toEqual([{ roomId: ROOM_ID, user: SELF_USER }]);
        expect(updateSelfUserUI).not.toHaveBeenCalled();
    });
});


describe("playlist:sync", () => {
    it("hands the playlist to the UI and leaves starting its videos to the server", async () => {
        // Arrange
        const { updatePlaylistUI } = await createManager();
        socket.emit.mockClear();
        const items = [playlistItem(VIDEO_A), playlistItem(VIDEO_B)];

        // Act
        await socket.receive("playlist:sync", playlistState({ eventId: 2, items, currentIndex: 1 }));

        // Assert
        expect(updatePlaylistUI).toHaveBeenCalledExactlyOnceWith(items, 1);
        expect(socket.emit).not.toHaveBeenCalled();
    });
});


describe("video:sync", () => {
    it("loads a new item at the server's time and reports the video change", async () => {
        // Arrange
        const { onVideoChange } = await createManager();

        // Act
        await receiveVideo(videoState({ videoUrl: VIDEO_A, currentTime: 30, eventId: 4 }));

        // Assert
        expect(latestPlayer().loadVideoById).toHaveBeenCalledExactlyOnceWith("aaaaaaaaaaa", 30);
        expect(onVideoChange).toHaveBeenCalledOnce();
    });

    it("drift-corrects the loaded item instead of reloading it", async () => {
        // Arrange
        const { onVideoChange } = await createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A, currentTime: 30, eventId: 4 }));
        latestPlayer().state = PlayerState.PLAYING;

        // Act
        await receiveVideo(videoState({ videoUrl: VIDEO_A, currentTime: 40, eventId: 5 }));

        // Assert
        expect(latestPlayer().loadVideoById).toHaveBeenCalledOnce();
        expect(latestPlayer().seekTo).toHaveBeenCalledExactlyOnceWith(40, true);
        expect(onVideoChange).toHaveBeenCalledOnce();
    });

    it("reloads the same URL from 0s when the server starts a different item, such as a repeat of the one that ended", async () => {
        // Arrange: A plays to its end
        const { onVideoChange } = await createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A, itemId: "item-a1", currentTime: 30, eventId: 4 }));
        latestPlayer().changeState(PlayerState.ENDED);

        // Act: the server starts a second copy of A
        await receiveVideo(videoState({ videoUrl: VIDEO_A, itemId: "item-a2", currentTime: 0, eventId: 5 }));

        // Assert
        expect(latestPlayer().loadVideoById.mock.calls).toEqual([["aaaaaaaaaaa", 30], ["aaaaaaaaaaa", 0]]);
        expect(onVideoChange).toHaveBeenCalledTimes(2);
    });

    it("creates no player while the room has no video", async () => {
        // Arrange
        const { onVideoChange } = await createManager();

        // Act
        await socket.receive("video:sync", videoState({ videoUrl: null, videoService: null }));

        // Assert
        expect(FakePlayer.instances).toEqual([]);
        expect(onVideoChange).not.toHaveBeenCalled();
    });

    it("picks the player from the URL when the state has no service", async () => {
        // Arrange
        await createManager();

        // Act
        await receiveVideo(videoState({ videoUrl: VIDEO_A, videoService: null }));

        // Assert
        expect(latestPlayer().loadVideoById).toHaveBeenCalledExactlyOnceWith("aaaaaaaaaaa", 0);
    });

    it("ignores a service the client doesn't support", async () => {
        // Arrange
        const { onVideoChange } = await createManager();

        // Act
        await socket.receive("video:sync", videoState({ videoUrl: VIDEO_A, videoService: "vimeo" as VideoService }));

        // Assert
        expect(FakePlayer.instances).toEqual([]);
        expect(onVideoChange).not.toHaveBeenCalled();
    });
});


describe("video end", () => {
    it("reports which item ended, so the server can drop every other member's duplicate report", async () => {
        // Arrange
        await createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A, itemId: "item-a1" }));

        // Act
        latestPlayer().changeState(PlayerState.ENDED);

        // Assert
        expect(socket.emitted("playlist:next")).toEqual([{ roomId: ROOM_ID, itemId: "item-a1" }]);
    });
});


describe("outbound requests", () => {
    it("queues a supported URL with its service", async () => {
        // Arrange
        const { manager } = await createManager();

        // Act
        manager.queueVideo(VIDEO_B);

        // Assert
        expect(socket.emitted("playlist:add")).toEqual([{ roomId: ROOM_ID, videoUrl: VIDEO_B, videoService: "youtube" }]);
    });

    it("alerts instead of queueing an unsupported URL", async () => {
        // Arrange
        const { manager } = await createManager();

        // Act
        manager.queueVideo(UNSUPPORTED_URL);

        // Assert
        expect(socket.emitted("playlist:add")).toEqual([]);
        expect(alertSpy).toHaveBeenCalledExactlyOnceWith(`Unsupported video URL: ${UNSUPPORTED_URL}`);
    });

    it("selects a playlist item and sends chat messages", async () => {
        // Arrange
        const { manager } = await createManager();

        // Act
        manager.selectPlaylistVideo(2);
        manager.sendChatMessage("hi all");

        // Assert
        expect(socket.emitted("playlist:select")).toEqual([{ roomId: ROOM_ID, index: 2 }]);
        expect(socket.emitted("chat:message")).toEqual([{ roomId: ROOM_ID, msg: "hi all" }]);
    });
});


describe("chat:sync", () => {
    it("hands the UI the whole log, in arrival order, as live messages", async () => {
        // Arrange
        const { updateChatUI } = await createManager();
        const first = chatMessage({ text: "first" });
        const second = chatMessage({ text: "second" });

        // Act
        await socket.receive("chat:sync", first);
        await socket.receive("chat:sync", second);

        // Assert
        expect(updateChatUI.mock.calls).toEqual([[[first], false], [[first, second], false]]);
    });
});


describe("destroy", () => {
    it("stops reacting to every sync event and destroys the player", async () => {
        // Arrange
        const { manager, onVideoChange, updatePlaylistUI, updateChatUI, updateUsersUI } = await createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A, eventId: 1 }));
        onVideoChange.mockClear();
        updateUsersUI.mockClear();

        // Act
        manager.destroy();
        await socket.receive("video:sync", videoState({ videoUrl: VIDEO_B, eventId: 2 }));
        await socket.receive("playlist:sync", playlistState({ eventId: 1, items: [playlistItem(VIDEO_B)] }));
        await socket.receive("chat:sync", chatMessage());
        await socket.receive("room:sync", roomSnapshot());
        await socket.receive("user:joined", OTHER_USER);
        await socket.receive("user:updated", OTHER_USER);
        await socket.receive("user:left", OTHER_USER.id);

        // Assert
        expect(latestPlayer().destroy).toHaveBeenCalledOnce();
        expect(latestPlayer().loadVideoById).toHaveBeenCalledOnce();
        expect(onVideoChange).not.toHaveBeenCalled();
        expect(updatePlaylistUI).not.toHaveBeenCalled();
        expect(updateChatUI).not.toHaveBeenCalled();
        expect(updateUsersUI).not.toHaveBeenCalled();
    });

    it("leaves the room so its events stop reaching this socket", async () => {
        // Arrange
        const { manager } = await createManager();

        // Act
        manager.destroy();

        // Assert
        expect(socket.emitted("room:leave")).toEqual([{ roomId: ROOM_ID }]);
    });
});


describe("video metadata", () => {
    it("has no current video info before any video is loaded", async () => {
        // Arrange
        const { manager } = await createManager();
        const fetchMock = stubFetch();

        // Act
        const info = await manager.fetchCurrentVideoInfo();

        // Assert
        expect(info).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fetches the current video's info from the video API", async () => {
        // Arrange
        const { manager } = await createManager();
        const fetchMock = stubFetch({ "/v1/video-api/youtube/video/aaaaaaaaaaa": { body: videoInfo("Video A") } });
        await receiveVideo(videoState({ videoUrl: VIDEO_A }));

        // Act
        const info = await manager.fetchCurrentVideoInfo();

        // Assert
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${BACKEND_URL}/v1/video-api/youtube/video/aaaaaaaaaaa`);
        expect(info).toEqual(videoInfo("Video A"));
    });
});
