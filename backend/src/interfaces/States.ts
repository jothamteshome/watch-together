/** Interface for video states stored on server */
export interface VideoState {
    eventId: number;
    videoUrl: string | null;
    currentTime: number;
    isPlaying: boolean;
    playbackRate: number;
    lastUpdate: number;
};


/** Interface for playlist states stored on server */
export interface PlaylistState {
    items: string[];
    currentIndex: number;
    isLooping: boolean;
    eventId: number;
};