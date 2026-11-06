import type PlaylistItem from "./PlaylistItem";
import type { VideoService } from "./VideoService";


/** Interface for video states stored on server */
export interface VideoState {
    eventId: number;
    itemId: string | null; // id of the loaded playlist item
    videoUrl: string | null;
    videoService: VideoService | null;
    currentTime: number;
    isPlaying: boolean;
    playbackRate: number;
    lastUpdate: number;
};


/** Interface for playlist states stored on server */
export interface PlaylistState {
    items: PlaylistItem[];
    currentIndex: number;
    isLooping: boolean;
    eventId: number;
};
