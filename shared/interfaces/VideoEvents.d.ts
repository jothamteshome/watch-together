import type { VideoService } from "./VideoService";


/** Interface for `video:set` events */
export interface VideoSetEvent {
    roomId: string;
    videoUrl: string;
    videoService?: VideoService;
};


/** Interface for `video:play`, `video:pause`, and `video:update` events */
export interface VideoUpdateEvent {
    roomId: string;
    time: number;
    playbackRate: number;
    eventId: number;
};
