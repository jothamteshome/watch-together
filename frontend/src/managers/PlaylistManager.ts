import Playlist from "../models/VideoPlaylist";
import type { PlaylistState } from "../interfaces/States";


/**
 * Manages playlist for a room.
 */
export default class PlaylistManager {
    private playlistEventId = 0;
    private playlist = new Playlist();
    private updatePlaylistUI: (videos: string[], index: number) => void;


    /**
     * Creates a new PlaylistManager instance.
     */
    constructor(updatePlaylistUI: (videos: string[], index: number) => void) {
        this.updatePlaylistUI = updatePlaylistUI;
    }


    /**
     * Updates the local state of the playlist to align with the server-provided state
     * @param state Server-provided state of playlist
     */
    public sync(state: PlaylistState): void {
        // Ignore sync events if the eventId is less than or equal to what is known to the client
        if (this.playlistEventId >= state.eventId) return;
        this.playlistEventId = state.eventId;

        // Sync the local playlist state with the server-provided playlist state
        this.playlist.sync(state);

        let displayIndex = state.currentIndex;
        if (displayIndex === -1 && this.playlist.length > 0) {
            // Keep last video visually selected when ended
            displayIndex = this.playlist.length - 1;
        }

        // Update the UI
        this.updatePlaylistUI(this.playlist.getPlaylist(), displayIndex);
    }


    get currentIndex(): number {
        return this.playlist.getCurrentIndex();
    }

    get currentItem(): string {
        return this.playlist.current;
    }

    get length(): number {
        return this.playlist.length;
    }


    /**
     * Cleans up all resources associated with this RoomManager,
     * including socket listeners and video manager instances.
     */
    destroy() {

    }
}
