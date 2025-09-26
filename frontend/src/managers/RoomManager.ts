import { BaseVideoManager } from "./BaseVideoManager";
import PlaylistManager from "./PlaylistManager";
import YoutubeManager from "./YoutubeManager";
import type { PlaylistState, VideoState } from "../interfaces/States";
import type { VideoService } from "../interfaces/VideoService";
import type VideoServiceInformation from "../interfaces/VideoServiceInformation";
import { socket } from "../services/socket";
import extractVideoId from "../utils/extractVideoId";



/**
 * Manages video playback and synchronization for a room.
 * Acts as a coordinator between socket events and video service managers (e.g. YouTube).
 */
export default class RoomManager {
    private roomId: string;
    private videoId?: string;
    private currentService?: VideoService;
    private videoManagers: Record<VideoService, BaseVideoManager>;
    private playlistManager: PlaylistManager;
    private onVideoChange: () => void;



    /**
     * Creates a new RoomManager instance for a specific room.
     *
     * @param roomId - The unique identifier for the room.
     */
    constructor(roomId: string, onVideoChange: () => void, updatePlaylistUI: (videos: string[], index: number) => void) {
        this.roomId = roomId;
        this.onVideoChange = onVideoChange;

        // Create the video managers record
        this.videoManagers = {
            youtube: new YoutubeManager(this.roomId, this.onVideoEnd)
        }

        for (const [service, manager] of Object.entries(this.videoManagers)) {
            manager.initPlayer(`${service}-player`);
        }


        // Create the playlist manager instance
        this.playlistManager = new PlaylistManager(updatePlaylistUI);

        this.registerSocketEvents();
    }


    /**
     * Registers socket listeners to handle incoming server events
     * (e.g. video synchronization, playlist synchronizaton).
     *
     * @private
     */
    private registerSocketEvents = (): void => {
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
    private syncVideo = (state: VideoState): void => {
        const result = this.resolveVideo(state.videoUrl);

        // Check validity of videoUrl
        if (!result) return;
        this.videoId = result.videoId;
        this.currentService = result.service

        // Sync video
        this.videoManagers[this.currentService!].sync(state);
        this.onVideoChange();
    }


    /**
     * Syncs the local playlist state with the server-provided playlist state.
     *
     * @param state - The current state of the playlist, including items, currentIndex, etc.
     * @private
     */
    private syncPlaylist = (state: PlaylistState): void => {
        // Update local videoId and service for current video
        const currentVideo = state.items[state.currentIndex];
        const result = this.resolveVideo(currentVideo);

        // Check validity of videoUrl
        if (!result) return;
        this.videoId = result.videoId;
        this.currentService = result.service

        // Get index before sync occurs
        const prevIndex = this.playlistManager.currentIndex;

        // Sync playlist
        this.playlistManager.sync(state);

        // Nothing to load if playlist is empty or ended
        if (this.playlistManager.length === 0 || state.currentIndex === -1) return;

        // Only load video if index changed
        if (prevIndex !== state.currentIndex) {
            this.loadVideo(this.playlistManager.currentItem);
        }
    }


    /**
     * Loads a new video into the current room. Validates the URL and notifies the server.
     *
     * @param videoUrl - The full video URL to load (e.g. YouTube link).
     * @private
     */
    private loadVideo = (videoUrl: string) => {
        const result = this.resolveVideo(videoUrl);

        // Check validity of videoUrl
        if (!result) return;
        this.videoId = result.videoId;
        this.currentService = result.service

        socket.emit("video:set", { roomId: this.roomId, videoUrl });
    }


    /**
     * Validates a video URL and extracts its service information.
     * 
     * @param videoUrl - The full URL of the video to validate.
     * @returns An object containing `videoId` and `service` if valid, otherwise `null`.
     * @private
     * 
     * This function also alerts the user if the URL is invalid or if the service
     * is unsupported. It centralizes video validation logic for reuse.
     */
    private resolveVideo = (videoUrl: string): VideoServiceInformation | null => {
        const { videoId, service } = extractVideoId(videoUrl);

        if (!videoId) {
            alert(`Invalid video URL: ${videoUrl}`);
            return null;
        }
        if (!service || !(service in this.videoManagers)) {
            alert(`${service} is an unsupported service`);
            return null;
        }

        return { videoId, service: service as VideoService };
    }


    /**
     * Handler for when the current video finishes playing.
     * 
     * Emits a `playlist:next` event to the server, instructing it to advance
     * to the next video in the room's playlist.
     * 
     * @private
     */
    private onVideoEnd = (): void => {
        socket.emit("playlist:next", { roomId: this.roomId });
    }


    /**
     * Adds a video to the room's playlist.
     * 
     * @param videoUrl - The URL of the video to queue.
     * 
     * This function first validates the video URL via `resolveVideo`. If valid,
     * it emits a `playlist:add` event to the server to add the video to the playlist.
     */
    public queueVideo = (videoUrl: string) => {
        const result = this.resolveVideo(videoUrl);

        // Check validity of videoUrl
        if (!result) return;

        socket.emit("playlist:add", { roomId: this.roomId, videoUrl });
    }


    /**
     * Retrieves the currently loaded video ID.
     * 
     * @returns The video ID string if a video is currently loaded, otherwise undefined.
     */
    public getVideoId = (): string | undefined => {
        return this.videoId;
    }


    /**
     * Selects a specific video in the playlist by index.
     * 
     * @param index - The index of the video to select in the playlist.
     * 
     * Emits a `playlist:select` event to the server to update the room's
     * current video.
     */
    public selectPlaylistVideo = (index: number): void => {
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
