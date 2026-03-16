import type { VideoService } from "../interfaces/VideoService";
import type BaseVideoInfo from "../interfaces/BaseVideoInfo";
import type { VideoState } from "../interfaces/States";

export abstract class BaseVideoManager {
    protected roomId: string;
    protected eventId: number = -1;
    protected lastPlaybackRate = 1;
    protected onVideoEnd: () => void;
    protected videoLoaded: boolean = false;
    readonly driftThreshold: number = 0.5;


    constructor(roomId: string, onVideoEnd: () => void) {
        this.roomId = roomId;
        this.onVideoEnd = onVideoEnd;
    }

    public isVideoLoaded(): boolean { return this.videoLoaded; }

    /** Returns true if this manager can handle the given URL. */
    public abstract canHandle(url: string): boolean;

    /** Returns the service identifier for this manager. */
    public abstract getServiceName(): VideoService;

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
    public abstract fetchVideoInfo(url: string): Promise<BaseVideoInfo | null>;

    public abstract destroy(): void;
    public abstract initPlayer(containerId: string): void;

    /** Applies drift-correction/state sync to an already-loaded video. */
    public abstract sync(state: VideoState): void;
    protected abstract syncHandler(state: VideoState): void;
    protected abstract monitorPlaybackRate(): void;

}