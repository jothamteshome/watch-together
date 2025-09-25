import { BaseVideoManager } from "./BaseVideoManager";
import YoutubeManager from "./YoutubeManager";
import Playlist from "../models/VideoPlaylist";
import type { PlaylistState, VideoState } from "../interfaces/States";
import { socket } from "../services/socket";
import extractVideoId from "../utils/extractVideoId";


type VideoService = "youtube";


/**
 * Manages video playback and synchronization for a room.
 * Acts as a coordinator between socket events and video service managers (e.g. YouTube).
 */
export default class RoomManager {
    private roomId: string;
    private videoId?: string;
    private currentService?: VideoService;
    private videoManagers: Record<VideoService, BaseVideoManager>;
    private onVideoChange: () => void;
    private onPlaylistUpdate: (videos: string[], index: number) => void;
    private playlistEventId = 0;
    private playlist = new Playlist();


    /**
     * Creates a new RoomManager instance for a specific room.
     *
     * @param roomId - The unique identifier for the room.
     */
    constructor(roomId: string, onVideoChange: () => void, onPlaylistUpdate: (videos: string[], index: number) => void) {
        this.roomId = roomId;
        this.onVideoChange = onVideoChange;
        this.onPlaylistUpdate = onPlaylistUpdate;

        this.videoManagers = {
            youtube: new YoutubeManager(this.roomId, this.onVideoEnd)
        }

        for (const [service, manager] of Object.entries(this.videoManagers)) {
            manager.initPlayer(`${service}-player`);
        }

        this.registerSocketEvents();
    }


    /**
     * Registers socket listeners to handle incoming server events
     * (e.g. video synchronization).
     *
     * @private
     */
    private registerSocketEvents() {
        // Sync events from server
        socket.on("video:sync", (state: VideoState) => this.syncVideo(state));
        socket.on("playlist:sync", (state: PlaylistState) => this.syncPlaylist(state));
    }


    /**
     * Syncs the local player state with the server-provided video state.
     *
     * @param state - The current state of the video, including URL, time, etc.
     * @private
     */
    private syncVideo(state: VideoState) {
        const { videoId, service } = extractVideoId(state.videoUrl);
        this.videoId = videoId;
        this.currentService = service as VideoService;

        if (!this.videoId) {
            alert("Invalid URL");
            return;
        }

        if (!this.currentService) {
            alert(`${service} is an unsupported service`);
            return;
        }

        this.videoManagers[this.currentService].sync(state);
        this.onVideoChange();
    }


    private syncPlaylist(state: PlaylistState) {
        // Ignore sync events if the eventId is less than or equal to what is known to the client
        if (this.playlistEventId >= state.eventId) return;
        this.playlistEventId = state.eventId;

        const prevIndex = this.playlist.getCurrentIndex();

        // Sync the local playlist state with the server-provided playlist state
        this.playlist.sync(state);

        let displayIndex = state.currentIndex;
        if (displayIndex === -1 && this.playlist.length > 0) {
            // Keep last video visually selected when ended
            displayIndex = this.playlist.length - 1;
        }

        this.onPlaylistUpdate(this.playlist.getPlaylist(), displayIndex);

        // Nothing to load if playlist is empty or ended
        if (this.playlist.length === 0 || state.currentIndex === -1) return;


        // Update local videoId and service for current video
        const currentVideo = this.playlist.current;
        const { videoId, service } = extractVideoId(currentVideo);
        this.videoId = videoId;
        this.currentService = service as VideoService;


        // Return if videoId is invalid
        if (!this.videoId) {
            console.warn("syncPlaylist: Invalid video URL:", currentVideo);
            return;
        }


        // Return if current service is not supported
        if (!this.currentService || !(this.currentService in this.videoManagers)) {
            console.warn(`syncPlaylist: Unsupported service: ${service}`);
            return;
        }


        // Only load video if index changed
        if (prevIndex !== state.currentIndex) {
            this.loadVideo(currentVideo);
        }
    }


    private onVideoEnd = () => {
        socket.emit("playlist:next", { roomId: this.roomId });
    }


    /**
     * Loads a new video into the current room. Validates the URL and notifies the server.
     *
     * @param videoUrl - The full video URL to load (e.g. YouTube link).
     */
    private loadVideo(videoUrl: string) {
        const { videoId, service } = extractVideoId(videoUrl);

        if (!videoId) {
            alert("Invalid URL");
            return;
        }

        if (!service || !(service in this.videoManagers)) {
            alert(`${service} is an unsupported service`);
            return;
        }

        this.videoId = videoId;
        this.currentService = service as VideoService;

        socket.emit("video:set", { roomId: this.roomId, videoUrl });
    }


    public queueVideo(videoUrl: string) {
        const { videoId, service } = extractVideoId(videoUrl);

        // Validate URL before emitting to server
        if (!videoId) {
            alert("Invalid URL");
            return;
        }

        // Validate service
        if (!service || !(service in this.videoManagers)) {
            alert(`${service} is an unsupported service`);
            return;
        }

        socket.emit("playlist:add", { roomId: this.roomId, videoUrl });
    }


    public getVideoId(): string | undefined {
        return this.videoId;
    }


    public selectPlaylistVideo(index: number) {
        socket.emit("playlist:select", { roomId: this.roomId, index });
    }


    /**
     * Cleans up all resources associated with this RoomManager,
     * including socket listeners and video manager instances.
     */
    destroy() {
        socket.off("playlist:sync");
        socket.off("video:sync");
        socket.off("video:set");
        Object.values(this.videoManagers).forEach(manager => manager.destroy());
    }
}
