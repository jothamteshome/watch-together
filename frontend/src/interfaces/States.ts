/** Interface for playlist states */
export interface PlaylistState {
    items: string[];
    currentIndex: number;
    isLooping: boolean;
    eventId: number;
};


export type VideoState = {
    videoUrl: string;
    currentTime: number;
    isPlaying: boolean;
    playbackRate: number;
    eventId: number;
};