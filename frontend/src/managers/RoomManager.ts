import { BaseVideoManager } from "./BaseVideoManager";
import ChatManager from "./ChatManager";
import PlaylistManager from "./PlaylistManager";
import YoutubeManager from "./YoutubeManager";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";
import type { PlaylistState, VideoState } from "@shared/interfaces/States";
import type { VideoService } from "@shared/interfaces/VideoService";
import { socket } from "../services/socket";



/**
 * Manages video playback and synchronization for a room.
 * Acts as a coordinator between socket events and video service managers (e.g. YouTube).
 *
 * Service-specific logic (URL detection, video loading, info fetching) is fully
 * delegated to the individual managers, keeping this class service-agnostic.
 */
export default class RoomManager {
    private roomId: string;
    private currentVideoUrl?: string;
    private currentService?: VideoService;
    private currentManager?: BaseVideoManager;
    private videoManagers: Record<VideoService, BaseVideoManager>;
    private playlistManager: PlaylistManager;
    private chatManager: ChatManager;
    private onVideoChange: () => void;



    constructor(
        roomId: string,
        onVideoChange: () => void,
        updatePlaylistUI: (videos: string[], index: number) => void,
        updateChatUI: (messages: ChatMessage[]) => void
    ) {
        this.roomId = roomId;
        this.onVideoChange = onVideoChange;

        this.videoManagers = {
            youtube: new YoutubeManager(this.roomId, this.onVideoEnd)
        };

        this.playlistManager = new PlaylistManager(updatePlaylistUI);
        this.chatManager = new ChatManager(updateChatUI);

        this.registerSocketEvents();
        this.joinRoom();
    }


    private registerSocketEvents = (): void => {
        socket.on("video:sync", (state: VideoState) => this.syncVideo(state));
        socket.on("playlist:sync", (state: PlaylistState) => this.syncPlaylist(state));
        socket.on("chat:sync", (msg: ChatMessage) => this.chatManager.add(msg));
    };


    /**
     * Connects the socket (if needed) and joins the room. Room membership is
     * independent of any specific video service's player lifecycle.
     */
    private joinRoom = (): void => {
        if (!socket.connected) {
            socket.connect();
            socket.once("connect", () => {
                socket.emit("room:join", { roomId: this.roomId });
            });
        } else {
            socket.emit("room:join", { roomId: this.roomId });
        }
    };


    /**
     * Syncs the local player with the server-provided video state.
     * If the URL changed, loads the new video; otherwise applies drift correction only.
     */
    private syncVideo = async (state: VideoState): Promise<void> => {
        if (!state.videoUrl) return;

        const manager = state.videoService
            ? this.videoManagers[state.videoService]
            : this.getManagerForUrl(state.videoUrl);
        if (!manager) return;

        manager.ensureInitialized(`${manager.getServiceName()}-player`);

        if (this.currentManager && this.currentManager !== manager) {
            this.currentManager.pause();
        }
        this.currentManager = manager;

        const urlChanged = state.videoUrl !== this.currentVideoUrl;
        this.currentVideoUrl = state.videoUrl;
        this.currentService = manager.getServiceName();

        // The manager may still be initializing (e.g. waiting on the YouTube iframe
        // API to load) — wait until it's actually ready before loading/syncing.
        await manager.whenReady();

        if (urlChanged) {
            manager.loadVideo(state.videoUrl, state.currentTime, state.eventId);
            this.onVideoChange();
        } else {
            manager.sync(state);
        }
    };


    /**
     * Syncs the local playlist state. Loads the new video when the active index changes.
     */
    private syncPlaylist = (state: PlaylistState): void => {
        const prevIndex = this.playlistManager.currentIndex;

        this.playlistManager.sync(state);

        if (this.playlistManager.length === 0 || state.currentIndex === -1) return;

        // Only emit video:set if the index changed AND the URL differs from what's already loaded.
        // Without the URL check, a joining user receives playlist:sync (prevIndex -1 → 0) and
        // incorrectly triggers loadVideo, resetting currentTime to 0 even though video:sync already
        // loaded the video at the correct timestamp.
        if (prevIndex !== state.currentIndex && this.playlistManager.currentItem !== this.currentVideoUrl) {
            this.loadVideo(this.playlistManager.currentItem);
        }
    };


    /**
     * Validates a video URL and emits video:set to the server.
     * Video loading into the player happens via the video:sync response.
     */
    private loadVideo = (videoUrl: string): void => {
        const manager = this.resolveManager(videoUrl);
        if (!manager) return;

        socket.emit("video:set", {
            roomId: this.roomId,
            videoUrl,
            videoService: manager.getServiceName()
        });
    };


    /**
     * Finds the manager that can handle the given URL.
     * Returns null without alerting if no manager supports the URL.
     */
    public getManagerForUrl = (videoUrl: string): BaseVideoManager | null => {
        return Object.values(this.videoManagers).find(manager => manager.canHandle(videoUrl)) ?? null;
    };


    /**
     * Finds the manager that can handle the given URL.
     * Alerts the user and returns null if no manager supports the URL.
     */
    private resolveManager = (videoUrl: string): BaseVideoManager | null => {
        const manager = this.getManagerForUrl(videoUrl);
        if (!manager) alert(`Unsupported video URL: ${videoUrl}`);
        return manager;
    };


    private onVideoEnd = (): void => {
        socket.emit("playlist:next", { roomId: this.roomId });
    };


    /**
     * Adds a video to the room's playlist after validating the URL.
     */
    public queueVideo = (videoUrl: string): void => {
        if (!this.resolveManager(videoUrl)) return;
        socket.emit("playlist:add", { roomId: this.roomId, videoUrl });
    };


    public sendChatMessage = (msg: string): void => {
        socket.emit("chat:message", { roomId: this.roomId, msg });
    };


    /**
     * Fetches metadata for the currently active video from the appropriate service manager.
     * Returns null if no video is loaded or the fetch fails.
     */
    public fetchCurrentVideoInfo = async (): Promise<VideoInfo | null> => {
        if (!this.currentVideoUrl || !this.currentService) return null;
        const manager = this.videoManagers[this.currentService];
        if (!manager) return null;
        return manager.fetchVideoInfo(this.currentVideoUrl);
    };


    /**
     * Fetches metadata for an arbitrary video URL (e.g. a playlist item that isn't
     * the currently active video) using whichever manager supports it.
     */
    public fetchVideoInfoForUrl = async (videoUrl: string): Promise<VideoInfo | null> => {
        const manager = this.getManagerForUrl(videoUrl);
        if (!manager) return null;
        return manager.fetchVideoInfo(videoUrl);
    };


    /**
     * Selects a specific video in the playlist by index.
     */
    public selectPlaylistVideo = (index: number): void => {
        socket.emit("playlist:select", { roomId: this.roomId, index });
    };


    destroy() {
        socket.off("playlist:sync");
        socket.off("video:sync");
        socket.off("chat:sync");
        Object.values(this.videoManagers).forEach(manager => manager.destroy());
    }
}
