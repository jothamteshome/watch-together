import type { VideoService } from "./VideoService";

/**
 * Interface for information about a service
 */
export default interface VideoServiceInformation {
    videoId: string;
    service: VideoService;
}