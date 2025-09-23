/** Interface for `playlist:add` events */
export interface PlaylistAddEvent {
    roomId: string;
    eventId: number;
    videoUrl: string;
};


/** Interface for `playlist:next` events */
export interface PlaylistNextEvent {
    roomId: string;
    eventId: number;
};