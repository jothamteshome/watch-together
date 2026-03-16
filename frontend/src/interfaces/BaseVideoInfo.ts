import type { VideoService } from "./VideoService";

/**
 * Minimal shared shape that all service-specific video info types extend.
 * The `serviceName` field acts as a discriminator for type-narrowing in components.
 */
export default interface BaseVideoInfo {
    serviceName: VideoService;
}
