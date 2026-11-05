import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import YoutubeManager from "../src/managers/YoutubeManager";
import { socket } from "./fakeSocket";
import { FakePlayer, installYoutube, latestPlayer, PlayerState } from "./fakeYoutube";
import { ROOM_ID, VIDEO_A, videoState } from "./helpers";

vi.mock("../src/services/socket", () => import("./fakeSocket"));


const VIDEO_A_ID = "aaaaaaaaaaa";
const T0 = Date.UTC(2026, 0, 1);

/** Creates a manager whose player has finished loading, as after the iframe API's onReady */
function createReadyManager() {
    const onVideoEnd = vi.fn();
    const manager = new YoutubeManager(ROOM_ID, onVideoEnd);
    manager.ensureInitialized("youtube-player");
    const player = latestPlayer();
    player.ready();
    return { manager, player, onVideoEnd };
}


beforeEach(() => {
    // monitorPlaybackRate starts a 200ms interval nothing ever clears; fake timers contain it
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    installYoutube();
});

afterEach(() => {
    document.querySelectorAll("script").forEach(script => script.remove());
    delete (window as Partial<Window>).onYouTubeIframeAPIReady;
});


describe("loadVideo", () => {
    it("adopts the server eventId so this client's play and pause events are accepted", () => {
        // Arrange
        const { manager, player } = createReadyManager();

        // Act
        manager.loadVideo(VIDEO_A, 30, 7);
        player.changeState(PlayerState.PLAYING);
        player.changeState(PlayerState.PAUSED);

        // Assert
        expect(socket.emitted("video:play")).toEqual([expect.objectContaining({ eventId: 7 })]);
        expect(socket.emitted("video:pause")).toEqual([expect.objectContaining({ eventId: 7 })]);
    });

    it("loads the video id at the server's start time", () => {
        // Arrange
        const { manager, player } = createReadyManager();

        // Act
        manager.loadVideo(VIDEO_A, 30, 7);

        // Assert
        expect(player.loadVideoById).toHaveBeenCalledExactlyOnceWith(VIDEO_A_ID, 30);
        expect(manager.isVideoLoaded()).toBe(true);
    });

    it("does nothing before the player exists or for a URL without a valid video id", () => {
        // Arrange
        const unready = new YoutubeManager(ROOM_ID, vi.fn());
        const { manager, player } = createReadyManager();

        // Act
        unready.loadVideo(VIDEO_A, 0, 1);
        manager.loadVideo("https://www.youtube.com/watch?v=tooShort", 0, 1);

        // Assert
        expect(unready.isVideoLoaded()).toBe(false);
        expect(manager.isVideoLoaded()).toBe(false);
        expect(player.loadVideoById).not.toHaveBeenCalled();
    });
});


describe("autoplay block", () => {
    it("doesn't broadcast the pause caused by a blocked autoplay, but does broadcast a later real pause", () => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 30, 7);

        // Act: autoplay is blocked, then the user starts and pauses the video
        player.changeState(PlayerState.PAUSED);
        const pausesWhileBlocked = socket.emitted("video:pause").length;
        player.changeState(PlayerState.PLAYING);
        player.time = 31.5;
        player.changeState(PlayerState.PAUSED);

        // Assert
        expect(pausesWhileBlocked).toBe(0);
        expect(socket.emitted("video:pause")).toEqual([{ roomId: ROOM_ID, time: 31.5, eventId: 7, playbackRate: 1 }]);
    });

    it("on the first play after a block, seeks to the server time plus wall-clock elapsed and broadcasts that time", () => {
        // Arrange: loaded at 30s, blocked, and the user clicks play 12s later
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 30, 7);
        player.changeState(PlayerState.PAUSED);
        vi.setSystemTime(T0 + 12_000);

        // Act
        player.changeState(PlayerState.PLAYING);

        // Assert
        expect(player.seekTo).toHaveBeenCalledExactlyOnceWith(42, true);
        expect(socket.emitted("video:play")).toEqual([{ roomId: ROOM_ID, time: 42, eventId: 7, playbackRate: 1 }]);
    });

    it("uses the player's own time for every play after the first", () => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 30, 7);
        player.changeState(PlayerState.PLAYING);
        player.seekTo.mockClear();
        player.time = 50;

        // Act: e.g. playback resumes after buffering
        player.changeState(PlayerState.PLAYING);

        // Assert
        expect(player.seekTo).not.toHaveBeenCalled();
        expect(socket.emitted("video:play").at(-1)).toMatchObject({ time: 50 });
    });

    it("respects a seek the user made while blocked instead of jumping to the server time", () => {
        // Arrange: blocked at 30s, then the user seeks to 90s, which broadcasts a pause there
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 30, 7);
        player.changeState(PlayerState.PAUSED);
        player.time = 90;
        player.changeState(PlayerState.PAUSED);
        vi.setSystemTime(T0 + 12_000);

        // Act
        player.changeState(PlayerState.PLAYING);

        // Assert
        expect(player.seekTo).not.toHaveBeenCalled();
        expect(socket.emitted("video:play")).toEqual([expect.objectContaining({ time: 90 })]);
    });
});


describe("pause", () => {
    it("stops playback without broadcasting a pause", () => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 0, 7);
        player.changeState(PlayerState.PLAYING);

        // Act
        manager.pause();
        player.changeState(PlayerState.PAUSED);

        // Assert
        expect(player.pauseVideo).toHaveBeenCalledOnce();
        expect(socket.emitted("video:pause")).toEqual([]);
    });
});


describe("video end", () => {
    it("calls onVideoEnd once and marks the video unloaded", () => {
        // Arrange
        const { manager, player, onVideoEnd } = createReadyManager();
        manager.loadVideo(VIDEO_A, 0, 7);
        player.changeState(PlayerState.PLAYING);

        // Act
        player.changeState(PlayerState.ENDED);

        // Assert
        expect(onVideoEnd).toHaveBeenCalledOnce();
        expect(manager.isVideoLoaded()).toBe(false);
    });
});


describe("sync", () => {
    it.each([
        { case: "the same eventId", eventId: 7 },
        { case: "an older eventId", eventId: 6 }
    ])("ignores a state with $case", ({ eventId }) => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 0, 7);
        player.state = PlayerState.PLAYING;

        // Act
        manager.sync(videoState({ eventId, currentTime: 100, isPlaying: false, playbackRate: 2 }));

        // Assert
        expect(player.seekTo).not.toHaveBeenCalled();
        expect(player.pauseVideo).not.toHaveBeenCalled();
        expect(player.setPlaybackRate).not.toHaveBeenCalled();
    });

    it.each([
        { drift: "0.5s", serverTime: 10.5, seeks: false },
        { drift: "0.6s", serverTime: 10.6, seeks: true }
    ])("seeks on $drift of drift: $seeks", ({ serverTime, seeks }) => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 10, 7);
        player.state = PlayerState.PLAYING;

        // Act
        manager.sync(videoState({ eventId: 8, currentTime: serverTime }));

        // Assert
        if (seeks) expect(player.seekTo).toHaveBeenCalledExactlyOnceWith(serverTime, true);
        else expect(player.seekTo).not.toHaveBeenCalled();
    });

    it.each([
        { playerState: PlayerState.PAUSED, isPlaying: true, call: "playVideo" as const },
        { playerState: PlayerState.PLAYING, isPlaying: false, call: "pauseVideo" as const }
    ])("calls $call when the player state differs from isPlaying $isPlaying", ({ playerState, isPlaying, call }) => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 0, 7);
        player.state = playerState;

        // Act
        manager.sync(videoState({ eventId: 8, isPlaying }));

        // Assert
        expect(player[call]).toHaveBeenCalledOnce();
    });

    it.each([
        { playerState: PlayerState.PLAYING, isPlaying: true },
        { playerState: PlayerState.PAUSED, isPlaying: false }
    ])("leaves a player already in state $playerState alone, with no seek or rate change", ({ playerState, isPlaying }) => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 0, 7);
        player.state = playerState;

        // Act
        manager.sync(videoState({ eventId: 8, isPlaying, currentTime: 0, playbackRate: 1 }));

        // Assert
        expect(player.playVideo).not.toHaveBeenCalled();
        expect(player.pauseVideo).not.toHaveBeenCalled();
        expect(player.seekTo).not.toHaveBeenCalled();
        expect(player.setPlaybackRate).not.toHaveBeenCalled();
    });

    it("applies a different server playback rate", () => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 0, 7);

        // Act
        manager.sync(videoState({ eventId: 8, playbackRate: 1.5 }));

        // Assert
        expect(player.setPlaybackRate).toHaveBeenCalledExactlyOnceWith(1.5);
    });
});


describe("playback rate monitor", () => {
    it("broadcasts a local rate change once, on the next 200ms poll", async () => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, 0, 7);
        player.time = 12;

        // Act
        player.rate = 2;
        await vi.advanceTimersByTimeAsync(200);
        await vi.advanceTimersByTimeAsync(1000);

        // Assert
        expect(socket.emitted("video:playbackrate")).toEqual([{ roomId: ROOM_ID, time: 12, eventId: 7, playbackRate: 2 }]);
    });

    it("stays quiet while the rate is unchanged", async () => {
        // Arrange
        const { manager } = createReadyManager();
        manager.loadVideo(VIDEO_A, 0, 7);

        // Act
        await vi.advanceTimersByTimeAsync(1000);

        // Assert
        expect(socket.emitted("video:playbackrate")).toEqual([]);
    });
});


describe("player initialization", () => {
    it("loads the iframe API when missing and creates one player only once the API is ready", async () => {
        // Arrange: no YT global yet, and a page script for the API tag to be inserted before
        vi.stubGlobal("YT", undefined);
        document.head.appendChild(document.createElement("script"));
        const manager = new YoutubeManager(ROOM_ID, vi.fn());
        let isReady = false;
        manager.whenReady().then(() => { isReady = true; });

        // Act
        manager.ensureInitialized("youtube-player");
        manager.ensureInitialized("youtube-player");
        const apiScripts = [...document.scripts].filter(script => script.src === "https://www.youtube.com/iframe_api");
        const playersBeforeApi = FakePlayer.instances.length;
        installYoutube();
        window.onYouTubeIframeAPIReady();
        await Promise.resolve();
        const readyBeforeOnReady = isReady;
        latestPlayer().ready();
        await manager.whenReady();

        // Assert
        expect(apiScripts).toHaveLength(1);
        expect(playersBeforeApi).toBe(0);
        expect(FakePlayer.instances.map(player => player.containerId)).toEqual(["youtube-player"]);
        expect(readyBeforeOnReady).toBe(false);
        expect(isReady).toBe(true);
    });
});


describe("URL support", () => {
    it.each([
        { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", id: "dQw4w9WgXcQ" },
        { url: "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42", id: "dQw4w9WgXcQ" },
        { url: "https://m.youtube.com/watch?v=dQw4w9WgXcQ", id: "dQw4w9WgXcQ" },
        { url: "https://youtu.be/dQw4w9WgXcQ", id: "dQw4w9WgXcQ" },
        { url: "https://www.youtube.com/shorts/dQw4w9WgXcQ", id: "dQw4w9WgXcQ" }
    ])("handles $url as video $id", ({ url, id }) => {
        // Arrange
        const manager = new YoutubeManager(ROOM_ID, vi.fn());

        // Act
        const result = { canHandle: manager.canHandle(url), id: manager.extractId(url) };

        // Assert
        expect(result).toEqual({ canHandle: true, id });
    });

    it.each([
        { url: "https://www.youtube.com/watch?v=tooShort", canHandle: true },
        { url: "https://vimeo.com/123456", canHandle: false },
        { url: "not a url", canHandle: false }
    ])("extracts no video id from $url", ({ url, canHandle }) => {
        // Arrange
        const manager = new YoutubeManager(ROOM_ID, vi.fn());

        // Act
        const result = { canHandle: manager.canHandle(url), id: manager.extractId(url) };

        // Assert
        expect(result).toEqual({ canHandle, id: null });
    });
});
