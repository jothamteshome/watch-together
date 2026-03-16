import type { VideoService } from "./VideoService";

/**
 * Interface for service-specific video identifier information.
 * `videoIdentifier` is the service's internal ID (e.g. YouTube video ID).
 */
export default interface VideoServiceInformation {
    videoIdentifier: string;
    service: VideoService;
}