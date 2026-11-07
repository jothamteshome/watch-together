import type { VideoService } from "./VideoService";


/** Interface for `playlist:add` events */
export interface PlaylistAddEvent {
    roomId: string;
    videoUrl: string;
    videoService: VideoService;
};


/** Interface for `playlist:next` events */
export interface PlaylistNextEvent {
    roomId: string;
    itemId: string; // id of the item that ended
};


/** Interface for `playlist:select` events */
export interface PlaylistSelectEvent {
    roomId: string;
    itemId: string; // id of the item to play
}
