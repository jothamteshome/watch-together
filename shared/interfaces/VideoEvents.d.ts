/** Interface for `video:play`, `video:pause`, and `video:update` events */
export interface VideoUpdateEvent {
    roomId: string;
    time: number;
    playbackRate: number;
    eventId: number;
};
