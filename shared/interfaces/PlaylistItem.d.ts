import type User from "./User";
import type { VideoService } from "./VideoService";

/** A queued video. `addedBy` is captured at add time, so a later rename doesn't rewrite it */
export default interface PlaylistItem {
    id: string;
    videoUrl: string;
    videoService: VideoService;
    addedBy: User;
}
