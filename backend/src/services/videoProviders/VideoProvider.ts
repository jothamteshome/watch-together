import type { VideoService } from "@shared/interfaces/VideoService";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";


/** Interface implemented by each per-service video metadata provider */
export default interface VideoProvider {
    readonly service: VideoService;
    getVideoInfo(id: string): Promise<VideoInfo>;
}
