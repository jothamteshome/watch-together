import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoState } from "@shared/interfaces/States";
import type { VideoService } from "@shared/interfaces/VideoService";
import RoomManager from "../src/managers/RoomManager";
import { socket } from "./fakeSocket";
import { FakePlayer, installYoutube, latestPlayer, PlayerState } from "./fakeYoutube";
import {
    BACKEND_URL,
    chatMessage,
    playlistState,
    ROOM_ID,
    stubFetch,
    UNSUPPORTED_URL,
    VIDEO_A,
    VIDEO_B,
    videoInfo,
    videoState
} from "./helpers";

vi.mock("../src/services/socket", () => import("./fakeSocket"));


function createManager({ connected = true } = {}) {
    socket.connected = connected;
    const onVideoChange = vi.fn();
    const updatePlaylistUI = vi.fn();
    const updateChatUI = vi.fn();
    const manager = new RoomManager(ROOM_ID, onVideoChange, updatePlaylistUI, updateChatUI);
    return { manager, onVideoChange, updatePlaylistUI, updateChatUI };
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
    it("doesn't re-set the video when the join-time playlist:sync arrives while the player is still loading", async () => {
        // Arrange: the server's join sequence for a video 30s in, before the iframe API is ready
        createManager();
        const videoSynced = socket.receive("video:sync", videoState({ videoUrl: VIDEO_A, currentTime: 30, eventId: 4 }));

        // Act
        await socket.receive("playlist:sync", playlistState({ eventId: 1, items: [VIDEO_A], currentIndex: 0 }));
        latestPlayer().ready();
        await videoSynced;

        // Assert
        expect(socket.emitted("video:set")).toEqual([]);
        expect(latestPlayer().loadVideoById).toHaveBeenCalledExactlyOnceWith("aaaaaaaaaaa", 30);
    });

    it("connects a disconnected socket and joins only once it's connected", async () => {
        // Arrange
        createManager({ connected: false });
        const joinsBeforeConnect = socket.emitted("room:join").length;

        // Act
        await socket.receive("connect");

        // Assert
        expect(socket.connect).toHaveBeenCalledOnce();
        expect(joinsBeforeConnect).toBe(0);
        expect(socket.emitted("room:join")).toEqual([{ roomId: ROOM_ID }]);
    });

    it("joins straight away on an already-connected socket", () => {
        // Arrange + Act
        createManager({ connected: true });

        // Assert
        expect(socket.connect).not.toHaveBeenCalled();
        expect(socket.emitted("room:join")).toEqual([{ roomId: ROOM_ID }]);
    });

    it.fails("BUG B3: a manager destroyed before the socket connects doesn't join (StrictMode remount)", async () => {
        // Arrange: StrictMode mounts, unmounts and remounts the room before the socket connects
        const { manager } = createManager({ connected: false });
        manager.destroy();
        createManager({ connected: false });

        // Act
        await socket.receive("connect");

        // Assert
        expect(socket.emitted("room:join")).toEqual([{ roomId: ROOM_ID }]);
    });
});


describe("playlist:sync", () => {
    it("sets the video once when the index moves to a different URL", async () => {
        // Arrange
        createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A }));
        await socket.receive("playlist:sync", playlistState({ eventId: 1, items: [VIDEO_A, VIDEO_B], currentIndex: 0 }));

        // Act
        await socket.receive("playlist:sync", playlistState({ eventId: 2, items: [VIDEO_A, VIDEO_B], currentIndex: 1 }));

        // Assert
        expect(socket.emitted("video:set")).toEqual([{ roomId: ROOM_ID, videoUrl: VIDEO_B, videoService: "youtube" }]);
    });

    it("doesn't set the video when an add leaves the index where it was", async () => {
        // Arrange
        createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A }));
        await socket.receive("playlist:sync", playlistState({ eventId: 1, items: [VIDEO_A], currentIndex: 0 }));

        // Act
        await socket.receive("playlist:sync", playlistState({ eventId: 2, items: [VIDEO_A, VIDEO_B], currentIndex: 0 }));

        // Assert
        expect(socket.emitted("video:set")).toEqual([]);
    });

    it.each([
        { case: "the playlist has ended", items: [VIDEO_A, VIDEO_B] },
        { case: "the playlist is empty", items: [] }
    ])("neither sets a video nor alerts when $case", async ({ items }) => {
        // Arrange
        createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A }));
        await socket.receive("playlist:sync", playlistState({ eventId: 1, items: [VIDEO_A, VIDEO_B], currentIndex: 0 }));

        // Act
        await socket.receive("playlist:sync", playlistState({ eventId: 2, items, currentIndex: -1 }));

        // Assert
        expect(socket.emitted("video:set")).toEqual([]);
        expect(alertSpy).not.toHaveBeenCalled();
    });

    it("alerts instead of setting a video the client can't play", async () => {
        // Arrange
        createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A }));
        await socket.receive("playlist:sync", playlistState({ eventId: 1, items: [VIDEO_A, UNSUPPORTED_URL], currentIndex: 0 }));

        // Act
        await socket.receive("playlist:sync", playlistState({ eventId: 2, items: [VIDEO_A, UNSUPPORTED_URL], currentIndex: 1 }));

        // Assert
        expect(socket.emitted("video:set")).toEqual([]);
        expect(alertSpy).toHaveBeenCalledExactlyOnceWith(`Unsupported video URL: ${UNSUPPORTED_URL}`);
    });

    it.fails("BUG B2: re-adding the video that just ended plays it again", async () => {
        // Arrange: A plays to the end and the playlist ends
        createManager();
        await socket.receive("playlist:sync", playlistState({ eventId: 1, items: [VIDEO_A], currentIndex: 0 }));
        await receiveVideo(videoState({ videoUrl: VIDEO_A }));
        latestPlayer().changeState(PlayerState.ENDED);
        await socket.receive("playlist:sync", playlistState({ eventId: 2, items: [VIDEO_A], currentIndex: -1 }));
        socket.emit.mockClear();

        // Act: someone queues A again
        await socket.receive("playlist:sync", playlistState({ eventId: 3, items: [VIDEO_A, VIDEO_A], currentIndex: 1 }));

        // Assert
        expect(socket.emitted("video:set")).toEqual([{ roomId: ROOM_ID, videoUrl: VIDEO_A, videoService: "youtube" }]);
    });

    it.fails("BUG B2: advancing onto a repeat of the video that just ended plays it again", async () => {
        // Arrange: A is queued twice and the first copy ends
        createManager();
        await socket.receive("playlist:sync", playlistState({ eventId: 1, items: [VIDEO_A, VIDEO_A], currentIndex: 0 }));
        await receiveVideo(videoState({ videoUrl: VIDEO_A }));
        latestPlayer().changeState(PlayerState.ENDED);
        socket.emit.mockClear();

        // Act
        await socket.receive("playlist:sync", playlistState({ eventId: 2, items: [VIDEO_A, VIDEO_A], currentIndex: 1 }));

        // Assert
        expect(socket.emitted("video:set")).toEqual([{ roomId: ROOM_ID, videoUrl: VIDEO_A, videoService: "youtube" }]);
    });
});


describe("video:sync", () => {
    it("loads a new URL at the server's time and reports the video change", async () => {
        // Arrange
        const { onVideoChange } = createManager();

        // Act
        await receiveVideo(videoState({ videoUrl: VIDEO_A, currentTime: 30, eventId: 4 }));

        // Assert
        expect(latestPlayer().loadVideoById).toHaveBeenCalledExactlyOnceWith("aaaaaaaaaaa", 30);
        expect(onVideoChange).toHaveBeenCalledOnce();
    });

    it("drift-corrects the loaded URL instead of reloading it", async () => {
        // Arrange
        const { onVideoChange } = createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A, currentTime: 30, eventId: 4 }));
        latestPlayer().state = PlayerState.PLAYING;

        // Act
        await receiveVideo(videoState({ videoUrl: VIDEO_A, currentTime: 40, eventId: 5 }));

        // Assert
        expect(latestPlayer().loadVideoById).toHaveBeenCalledOnce();
        expect(latestPlayer().seekTo).toHaveBeenCalledExactlyOnceWith(40, true);
        expect(onVideoChange).toHaveBeenCalledOnce();
    });

    it("creates no player while the room has no video", async () => {
        // Arrange
        const { onVideoChange } = createManager();

        // Act
        await socket.receive("video:sync", videoState({ videoUrl: null, videoService: null }));

        // Assert
        expect(FakePlayer.instances).toEqual([]);
        expect(onVideoChange).not.toHaveBeenCalled();
    });

    it("picks the player from the URL when the state has no service", async () => {
        // Arrange
        createManager();

        // Act
        await receiveVideo(videoState({ videoUrl: VIDEO_A, videoService: null }));

        // Assert
        expect(latestPlayer().loadVideoById).toHaveBeenCalledExactlyOnceWith("aaaaaaaaaaa", 0);
    });

    it("ignores a service the client doesn't support", async () => {
        // Arrange
        const { onVideoChange } = createManager();

        // Act
        await socket.receive("video:sync", videoState({ videoUrl: VIDEO_A, videoService: "vimeo" as VideoService }));

        // Assert
        expect(FakePlayer.instances).toEqual([]);
        expect(onVideoChange).not.toHaveBeenCalled();
    });
});


describe("video end", () => {
    it("asks the server for the next playlist item", async () => {
        // Arrange
        createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A }));

        // Act
        latestPlayer().changeState(PlayerState.ENDED);

        // Assert
        expect(socket.emitted("playlist:next")).toEqual([expect.objectContaining({ roomId: ROOM_ID })]);
    });

    it.fails("BUG B1: sends the playlist eventId so the server can drop every viewer's duplicate next", async () => {
        // Arrange
        createManager();
        await socket.receive("playlist:sync", playlistState({ eventId: 7, items: [VIDEO_A, VIDEO_B], currentIndex: 0 }));
        await receiveVideo(videoState({ videoUrl: VIDEO_A }));

        // Act
        latestPlayer().changeState(PlayerState.ENDED);

        // Assert
        expect(socket.emitted("playlist:next")).toEqual([{ roomId: ROOM_ID, eventId: 7 }]);
    });
});


describe("outbound requests", () => {
    it("queues a supported URL", () => {
        // Arrange
        const { manager } = createManager();

        // Act
        manager.queueVideo(VIDEO_B);

        // Assert
        expect(socket.emitted("playlist:add")).toEqual([{ roomId: ROOM_ID, videoUrl: VIDEO_B }]);
    });

    it("alerts instead of queueing an unsupported URL", () => {
        // Arrange
        const { manager } = createManager();

        // Act
        manager.queueVideo(UNSUPPORTED_URL);

        // Assert
        expect(socket.emitted("playlist:add")).toEqual([]);
        expect(alertSpy).toHaveBeenCalledExactlyOnceWith(`Unsupported video URL: ${UNSUPPORTED_URL}`);
    });

    it("selects a playlist item and sends chat messages", () => {
        // Arrange
        const { manager } = createManager();

        // Act
        manager.selectPlaylistVideo(2);
        manager.sendChatMessage("hi all");

        // Assert
        expect(socket.emitted("playlist:select")).toEqual([{ roomId: ROOM_ID, index: 2 }]);
        expect(socket.emitted("chat:message")).toEqual([{ roomId: ROOM_ID, msg: "hi all" }]);
    });
});


describe("chat:sync", () => {
    it("hands the UI the whole log, in arrival order", async () => {
        // Arrange
        const { updateChatUI } = createManager();
        const first = chatMessage({ text: "first" });
        const second = chatMessage({ text: "second" });

        // Act
        await socket.receive("chat:sync", first);
        await socket.receive("chat:sync", second);

        // Assert
        expect(updateChatUI.mock.calls).toEqual([[[first]], [[first, second]]]);
    });
});


describe("destroy", () => {
    it("stops reacting to every sync event and destroys the player", async () => {
        // Arrange
        const { manager, onVideoChange, updatePlaylistUI, updateChatUI } = createManager();
        await receiveVideo(videoState({ videoUrl: VIDEO_A, eventId: 1 }));
        onVideoChange.mockClear();

        // Act
        manager.destroy();
        await socket.receive("video:sync", videoState({ videoUrl: VIDEO_B, eventId: 2 }));
        await socket.receive("playlist:sync", playlistState({ eventId: 1, items: [VIDEO_B] }));
        await socket.receive("chat:sync", chatMessage());

        // Assert
        expect(latestPlayer().destroy).toHaveBeenCalledOnce();
        expect(latestPlayer().loadVideoById).toHaveBeenCalledOnce();
        expect(onVideoChange).not.toHaveBeenCalled();
        expect(updatePlaylistUI).not.toHaveBeenCalled();
        expect(updateChatUI).not.toHaveBeenCalled();
        expect(socket.emitted("video:set")).toEqual([]);
    });

    it.fails("BUG B3: leaves the room so its events stop reaching this socket", () => {
        // Arrange
        const { manager } = createManager();

        // Act
        manager.destroy();

        // Assert
        expect(socket.emitted("room:leave")).toEqual([{ roomId: ROOM_ID }]);
    });
});


describe("video metadata", () => {
    it("has no current video info before any video is loaded", async () => {
        // Arrange
        const { manager } = createManager();
        const fetchMock = stubFetch();

        // Act
        const info = await manager.fetchCurrentVideoInfo();

        // Assert
        expect(info).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fetches the current video's info from the video API", async () => {
        // Arrange
        const { manager } = createManager();
        const fetchMock = stubFetch({ "/v1/video-api/youtube/video/aaaaaaaaaaa": { body: videoInfo("Video A") } });
        await receiveVideo(videoState({ videoUrl: VIDEO_A }));

        // Act
        const info = await manager.fetchCurrentVideoInfo();

        // Assert
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${BACKEND_URL}/v1/video-api/youtube/video/aaaaaaaaaaa`);
        expect(info).toEqual(videoInfo("Video A"));
    });
});
