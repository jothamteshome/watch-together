import { BaseVideoManager } from "./BaseVideoManager";
import { type VideoState } from "../interfaces/States";
import type { VideoService } from "../interfaces/VideoService";
import type BaseVideoInfo from "../interfaces/BaseVideoInfo";
import type YoutubeVideoInfo from "../interfaces/YoutubeVideoInfo";
import { socket } from "../services/socket";
import extractVideoId from "../utils/extractVideoId";

declare global {
    interface Window {
        YT: typeof YT;
        onYouTubeIframeAPIReady: () => void;
    }
}

export default class YoutubeManager extends BaseVideoManager {
    private player: YT.Player | null = null;
    // Suppresses the PAUSED state-change that fires when the browser blocks autoplay.
    private suppressNextPause = false;
    // Tracks the server-provided time and local timestamp at load, so we can
    // compute the correct seek position when the user manually clicks play after
    // an autoplay block (avoiding a snap-back to the stale paused position).
    private loadedServerTime: number | null = null;
    private loadedLocalTime: number | null = null;

    // ── BaseVideoManager abstractions ─────────────────────────────────────────

    public canHandle(url: string): boolean {
        try {
            const hostname = new URL(url).hostname;
            return hostname.includes("youtu.be") || hostname.includes("youtube.com");
        } catch {
            return false;
        }
    }

    public getServiceName(): VideoService {
        return "youtube";
    }

    /**
     * Loads a new video into the player at the given start time.
     * Separate from syncHandler — this is called when the video URL changes,
     * while syncHandler only corrects drift/state on an already-loaded video.
     */
    public loadVideo(url: string, startTime: number, eventId: number): void {
        if (!this.player) return;
        const videoIdentifier = this.extractId(url);
        if (!videoIdentifier) return;
        this.player.loadVideoById(videoIdentifier, startTime);
        this.videoLoaded = true;
        this.eventId = eventId;
        this.suppressNextPause = true;
        this.loadedServerTime = startTime;
        this.loadedLocalTime = Date.now();
    }

    /**
     * Fetches YouTube video metadata from the backend.
     * Returns null if the URL is invalid or the request fails.
     */
    public async fetchVideoInfo(url: string): Promise<BaseVideoInfo | null> {
        try {
            const videoIdentifier = this.extractId(url);
            if (!videoIdentifier) return null;

            const response = await fetch(
                `${import.meta.env.VITE_APP_BACKEND_URL}/v1/video-api/youtube/video/${videoIdentifier}`
            );
            if (!response.ok) return null;

            const data = await response.json();
            const info: YoutubeVideoInfo = { ...data, serviceName: "youtube" };
            return info;
        } catch {
            return null;
        }
    }

    // ── Player lifecycle ──────────────────────────────────────────────────────

    destroy() {
        this.player?.destroy();
        this.player = null;
    }

    public initPlayer(containerId = "youtube-player") {
        const init = () => {
            if (this.player) return;

            this.player = new window.YT.Player(containerId, {
                playerVars: { playsinline: 1 },
                events: {
                    onReady: this.onPlayerReady,
                    onStateChange: this.onPlayerStateChange,
                },
            });
        };

        if (!window.YT) {
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName("script")[0];
            firstScriptTag.parentNode!.insertBefore(tag, firstScriptTag);
            window.onYouTubeIframeAPIReady = init;
        } else {
            init();
        }
    }

    // ── State sync (drift correction only — no video loading) ─────────────────

    public sync(state: VideoState): void {
        this.syncHandler(state);
    }

    protected syncHandler({ currentTime, isPlaying, playbackRate, eventId }: VideoState): void {
        if (!this.player) return;

        if (this.eventId >= eventId) return;
        this.eventId = eventId;

        if (this.player.getPlaybackRate() !== playbackRate) {
            this.player.setPlaybackRate(playbackRate);
        }

        const drift = Math.abs(this.player.getCurrentTime() - currentTime);
        if (drift > this.driftThreshold) {
            this.player.seekTo(currentTime, true);
        }

        if (isPlaying && this.player.getPlayerState() !== YT.PlayerState.PLAYING) {
            this.player.playVideo();
        } else if (!isPlaying && this.player.getPlayerState() !== YT.PlayerState.PAUSED) {
            this.player.pauseVideo();
        }
    }

    protected monitorPlaybackRate(): void {
        setInterval(() => {
            if (!this.player) return;
            const currentRate = this.player.getPlaybackRate();

            if (currentRate !== this.lastPlaybackRate) {
                this.lastPlaybackRate = currentRate;
                socket.emit("video:playbackrate", {
                    roomId: this.roomId,
                    time: this.player.getCurrentTime(),
                    eventId: this.eventId,
                    playbackRate: currentRate
                });
            }
        }, 200);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /** Extracts the YouTube video ID from a URL string. Returns null if invalid. */
    private extractId(url: string): string | null {
        try {
            const result = extractVideoId(url);
            return result.videoIdentifier ?? null;
        } catch {
            return null;
        }
    }

    private onPlayerReady = () => {
        if (!socket.connected) {
            socket.connect();
            socket.once("connect", () => {
                socket.emit("room:join", { roomId: this.roomId });
            });
        } else {
            socket.emit("room:join", { roomId: this.roomId });
        }

        this.monitorPlaybackRate();
    };

    private onPlayerStateChange = (event: YT.OnStateChangeEvent) => {
        const player = event.target;
        const time = player.getCurrentTime();
        const playbackRate = player.getPlaybackRate();

        if (event.data === YT.PlayerState.PLAYING) {
            this.suppressNextPause = false;

            let time = player.getCurrentTime();

            // If recovering from an autoplay block, the local player is still at the
            // stale seek position. Compute the expected server time by adding elapsed
            // wall-clock time since the video was loaded, then seek before emitting.
            if (this.loadedServerTime !== null && this.loadedLocalTime !== null) {
                const elapsed = (Date.now() - this.loadedLocalTime) / 1000;
                time = this.loadedServerTime + elapsed;
                this.player!.seekTo(time, true);
                this.loadedServerTime = null;
                this.loadedLocalTime = null;
            }

            socket.emit("video:play", { roomId: this.roomId, time, eventId: this.eventId, playbackRate });
        } else if (event.data === YT.PlayerState.PAUSED) {
            if (this.suppressNextPause) {
                // Browser blocked autoplay — don't propagate this to the server.
                this.suppressNextPause = false;
                return;
            }
            this.loadedServerTime = null;
            this.loadedLocalTime = null;
            socket.emit("video:pause", { roomId: this.roomId, time, eventId: this.eventId, playbackRate });
        } else if (event.data === YT.PlayerState.ENDED) {
            this.suppressNextPause = false;
            this.loadedServerTime = null;
            this.loadedLocalTime = null;
            this.videoLoaded = false;
            this.onVideoEnd();
        }
    };
}
