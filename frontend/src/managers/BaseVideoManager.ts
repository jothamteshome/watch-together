import type { VideoService } from "@shared/interfaces/VideoService";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";
import type { VideoState } from "@shared/interfaces/States";

export abstract class BaseVideoManager {
    protected roomId: string;
    protected eventId: number = -1;
    protected lastPlaybackRate = 1;
    protected onVideoEnd: () => void;
    protected videoLoaded: boolean = false;
    private initialized: boolean = false;
    private ready: boolean = false;
    private readyPromise: Promise<void> | null = null;
    private resolveReady: (() => void) | null = null;
    readonly driftThreshold: number = 0.5;


    constructor(roomId: string, onVideoEnd: () => void) {
        this.roomId = roomId;
        this.onVideoEnd = onVideoEnd;
    }

    public isVideoLoaded(): boolean { return this.videoLoaded; }

    /** Initializes the player the first time it's actually needed; no-ops on later calls. */
    public ensureInitialized(containerId: string): void {
        if (this.initialized) return;
        this.initialized = true;
        this.initPlayer(containerId);
    }

    /** Resolves once the player is ready to receive loadVideo/sync calls. Safe to await from multiple callers. */
    public whenReady(): Promise<void> {
        if (this.ready) return Promise.resolve();
        if (!this.readyPromise) {
            this.readyPromise = new Promise(resolve => { this.resolveReady = resolve; });
        }
        return this.readyPromise;
    }

    /** Called by subclasses once their underlying player has finished initializing. */
    protected markReady(): void {
        this.ready = true;
        this.resolveReady?.();
    }

    /** Returns true if this manager can handle the given URL. */
    public abstract canHandle(url: string): boolean;

    /** Returns the service identifier for this manager. */
    public abstract getServiceName(): VideoService;

    /** Extracts this service's identifier from a URL. Returns null if the URL doesn't match. */
    public abstract extractId(url: string): string | null;

    /**
     * Loads a new video by URL at the given start time.
     * `eventId` must be set to the server's current eventId so that subsequent
     * play/pause/seek events emitted by this client are accepted by the server.
     */
    public abstract loadVideo(url: string, startTime: number, eventId: number): void;

    /**
     * Fetches metadata for the given video URL from the backend.
     * Returns null if the URL is invalid or the request fails.
     */
    public async fetchVideoInfo(url: string): Promise<VideoInfo | null> {
        try {
            const id = this.extractId(url);
            if (!id) return null;

            const response = await fetch(
                `${import.meta.env.VITE_APP_BACKEND_URL}/v1/video-api/${this.getServiceName()}/video/${id}`
            );
            if (!response.ok) return null;

            return await response.json() as VideoInfo;
        } catch {
            return null;
        }
    }

    /** Fully stops playback, independent of whether this manager's container is visible. */
    public abstract pause(): void;

    public abstract destroy(): void;
    public abstract initPlayer(containerId: string): void;

    /** Applies drift-correction/state sync to an already-loaded video. */
    public abstract sync(state: VideoState): void;
    protected abstract syncHandler(state: VideoState): void;
    protected abstract monitorPlaybackRate(): void;

}
