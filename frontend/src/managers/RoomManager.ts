import { BaseVideoManager } from "./BaseVideoManager";
import ChatManager from "./ChatManager";
import PlaylistManager from "./PlaylistManager";
import YoutubeManager from "./YoutubeManager";
import type ChatMessage from "../interfaces/ChatMessage";
import type BaseVideoInfo from "../interfaces/BaseVideoInfo";
import type { PlaylistState, VideoState } from "../interfaces/States";
import type { VideoService } from "../interfaces/VideoService";
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

        for (const [service, manager] of Object.entries(this.videoManagers)) {
            manager.initPlayer(`${service}-player`);
        }

        this.playlistManager = new PlaylistManager(updatePlaylistUI);
        this.chatManager = new ChatManager(updateChatUI);

        this.registerSocketEvents();
    }


    private registerSocketEvents = (): void => {
        socket.on("video:sync", (state: VideoState) => this.syncVideo(state));
        socket.on("playlist:sync", (state: PlaylistState) => this.syncPlaylist(state));
        socket.on("chat:sync", (msg: ChatMessage) => this.chatManager.add(msg));
    };


    /**
     * Syncs the local player with the server-provided video state.
     * If the URL changed, loads the new video; otherwise applies drift correction only.
     */
    private syncVideo = (state: VideoState): void => {
        if (!state.videoUrl) return;

        const manager = this.resolveManager(state.videoUrl);
        if (!manager) return;

        const urlChanged = state.videoUrl !== this.currentVideoUrl;
        this.currentVideoUrl = state.videoUrl;
        this.currentService = manager.getServiceName();

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
     * Alerts the user and returns null if no manager supports the URL.
     */
    private resolveManager = (videoUrl: string): BaseVideoManager | null => {
        for (const manager of Object.values(this.videoManagers)) {
            if (manager.canHandle(videoUrl)) {
                return manager;
            }
        }
        alert(`Unsupported video URL: ${videoUrl}`);
        return null;
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
    public fetchCurrentVideoInfo = async (): Promise<BaseVideoInfo | null> => {
        if (!this.currentVideoUrl || !this.currentService) return null;
        const manager = this.videoManagers[this.currentService];
        if (!manager) return null;
        return manager.fetchVideoInfo(this.currentVideoUrl);
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


