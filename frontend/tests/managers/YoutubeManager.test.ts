import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import YoutubeManager from "../../src/managers/YoutubeManager";
import { socket } from "../support/fakeSocket";
import { FakePlayer, installYoutube, latestPlayer, PlayerState } from "../support/fakeYoutube";
import { ROOM_ID, VIDEO_A, videoState } from "../support/helpers";

vi.mock("../../src/services/socket", () => import("../support/fakeSocket"));


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

        // Act: the load's own autoplay, then the user pauses and resumes
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 30, eventId: 7 }));
        player.changeState(PlayerState.PLAYING);
        player.changeState(PlayerState.PAUSED);
        player.changeState(PlayerState.PLAYING);

        // Assert
        expect(socket.emitted("video:play")).toEqual([expect.objectContaining({ eventId: 7 })]);
        expect(socket.emitted("video:pause")).toEqual([expect.objectContaining({ eventId: 7 })]);
    });

    it("loads the video id at the server's start time", () => {
        // Arrange
        const { manager, player } = createReadyManager();

        // Act
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 30, eventId: 7 }));

        // Assert
        expect(player.loadVideoById).toHaveBeenCalledExactlyOnceWith(VIDEO_A_ID, 30);
        expect(manager.isVideoLoaded()).toBe(true);
    });

    it("cues a paused state at the server's time instead of playing it, and treats the next play as the user's", () => {
        // Arrange: a playing load is still waiting for its first PLAYING when the room's paused state arrives
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 10, eventId: 6 }));

        // Act
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 30, eventId: 7, isPlaying: false }));
        player.changeState(PlayerState.PLAYING);

        // Assert: the cue adopts eventId 7 and drops the earlier load's catch-up
        expect(player.cueVideoById).toHaveBeenCalledExactlyOnceWith(VIDEO_A_ID, 30);
        expect(player.seekTo).not.toHaveBeenCalled();
        expect(socket.emitted("video:play")).toEqual([{ roomId: ROOM_ID, time: 30, eventId: 7, playbackRate: 1 }]);
        expect(manager.isVideoLoaded()).toBe(true);
    });

    it("does nothing before the player exists or for a URL without a valid video id", () => {
        // Arrange
        const unready = new YoutubeManager(ROOM_ID, vi.fn());
        const { manager, player } = createReadyManager();

        // Act
        unready.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 1 }));
        manager.loadVideo("https://www.youtube.com/watch?v=tooShort", videoState({ currentTime: 0, eventId: 1 }));

        // Assert
        expect(unready.isVideoLoaded()).toBe(false);
        expect(manager.isVideoLoaded()).toBe(false);
        expect(player.loadVideoById).not.toHaveBeenCalled();
        expect(player.cueVideoById).not.toHaveBeenCalled();
    });
});


describe("autoplay block", () => {
    it("doesn't broadcast the pause caused by a blocked autoplay, but does broadcast a later real pause", () => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 30, eventId: 7 }));

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

    it("on the first play after a block, seeks to the server time plus wall-clock elapsed without broadcasting", () => {
        // Arrange: loaded at 30s, blocked, and the user clicks play 12s later
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 30, eventId: 7 }));
        player.changeState(PlayerState.PAUSED);
        vi.setSystemTime(T0 + 12_000);

        // Act
        player.changeState(PlayerState.PLAYING);

        // Assert: the server already has this state, so the catch-up stays local
        expect(player.seekTo).toHaveBeenCalledExactlyOnceWith(42, true);
        expect(socket.emitted("video:play")).toEqual([]);
    });

    it("uses the player's own time for every play after the first", () => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 30, eventId: 7 }));
        player.changeState(PlayerState.PLAYING);
        player.seekTo.mockClear();
        player.time = 50;

        // Act: e.g. playback resumes after buffering
        player.changeState(PlayerState.PLAYING);

        // Assert
        expect(player.seekTo).not.toHaveBeenCalled();
        expect(socket.emitted("video:play")).toEqual([{ roomId: ROOM_ID, time: 50, eventId: 7, playbackRate: 1 }]);
    });

    it("catches up to a newer playing state that arrived while blocked, not the one it loaded with", () => {
        // Arrange: loaded at 30s and blocked; 5s later the room seeks to 100s
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 30, eventId: 7 }));
        player.changeState(PlayerState.PAUSED);
        vi.setSystemTime(T0 + 5000);
        manager.sync(videoState({ currentTime: 100, eventId: 8 }));
        player.seekTo.mockClear();

        // Act: the user clicks play 3s after the seek
        vi.setSystemTime(T0 + 8000);
        player.changeState(PlayerState.PLAYING);

        // Assert
        expect(player.seekTo).toHaveBeenCalledExactlyOnceWith(103, true);
        expect(socket.emitted("video:play")).toEqual([]);
    });

    it("drops the catch-up once the room pauses while blocked, so the user's play is a real one", () => {
        // Arrange: loaded at 30s and blocked, then the room pauses at 50s
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 30, eventId: 7 }));
        player.changeState(PlayerState.PAUSED);
        manager.sync(videoState({ currentTime: 50, isPlaying: false, eventId: 8 }));
        player.seekTo.mockClear();

        // Act
        player.changeState(PlayerState.PLAYING);

        // Assert
        expect(player.seekTo).not.toHaveBeenCalled();
        expect(socket.emitted("video:play")).toEqual([{ roomId: ROOM_ID, time: 50, eventId: 8, playbackRate: 1 }]);
    });

    it("respects a seek the user made while blocked instead of jumping to the server time", () => {
        // Arrange: blocked at 30s, then the user seeks to 90s, which broadcasts a pause there
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 30, eventId: 7 }));
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
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));
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
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));
        player.changeState(PlayerState.PLAYING);

        // Act
        player.changeState(PlayerState.ENDED);

        // Assert
        expect(onVideoEnd).toHaveBeenCalledOnce();
        expect(manager.isVideoLoaded()).toBe(false);
    });

    it.each([
        { state: "BUFFERING", value: PlayerState.BUFFERING },
        { state: "CUED", value: PlayerState.CUED },
        { state: "UNSTARTED", value: PlayerState.UNSTARTED }
    ])("neither broadcasts nor ends the video on $state", ({ value }) => {
        // Arrange
        const { manager, player, onVideoEnd } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));
        player.changeState(PlayerState.PLAYING);
        socket.emit.mockClear();

        // Act
        player.changeState(value);

        // Assert
        expect(socket.emit).not.toHaveBeenCalled();
        expect(onVideoEnd).not.toHaveBeenCalled();
        expect(manager.isVideoLoaded()).toBe(true);
    });
});


describe("sync", () => {
    it.each([
        { case: "the same eventId", eventId: 7 },
        { case: "an older eventId", eventId: 6 }
    ])("ignores a state with $case", ({ eventId }) => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));
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
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 10, eventId: 7 }));
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
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));
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
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));
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
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));

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
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));
        player.time = 12;

        // Act
        player.rate = 2;
        await vi.advanceTimersByTimeAsync(200);
        await vi.advanceTimersByTimeAsync(1000);

        // Assert
        expect(socket.emitted("video:playbackrate")).toEqual([{ roomId: ROOM_ID, time: 12, eventId: 7, playbackRate: 2 }]);
    });

    it("does not send back a rate it applied from a server sync", async () => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));

        // Act
        manager.sync(videoState({ eventId: 8, playbackRate: 1.5 }));
        await vi.advanceTimersByTimeAsync(1000);

        // Assert
        expect(player.rate).toBe(1.5);
        expect(socket.emitted("video:playbackrate")).toEqual([]);
    });

    it("still sends a rate the user sets after a server sync", async () => {
        // Arrange
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));
        manager.sync(videoState({ eventId: 8, playbackRate: 1.5 }));
        await vi.advanceTimersByTimeAsync(200);

        // Act
        player.rate = 2;
        await vi.advanceTimersByTimeAsync(1000);

        // Assert
        expect(socket.emitted("video:playbackrate")).toEqual([{ roomId: ROOM_ID, time: 0, eventId: 8, playbackRate: 2 }]);
    });

    it("sends the user's change back to the old rate after a server sync changed it", async () => {
        // Arrange: the server set 2x, and the user returns to 1x, the rate the monitor last saw before the sync
        const { manager, player } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));
        manager.sync(videoState({ eventId: 8, playbackRate: 2 }));
        await vi.advanceTimersByTimeAsync(200);

        // Act
        player.rate = 1;
        await vi.advanceTimersByTimeAsync(1000);

        // Assert
        expect(socket.emitted("video:playbackrate")).toEqual([{ roomId: ROOM_ID, time: 0, eventId: 8, playbackRate: 1 }]);
    });

    it("stays quiet while the rate is unchanged", async () => {
        // Arrange
        const { manager } = createReadyManager();
        manager.loadVideo(VIDEO_A, videoState({ currentTime: 0, eventId: 7 }));

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
