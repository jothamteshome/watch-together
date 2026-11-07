import type { VideoService } from "@shared/interfaces/VideoService";
import type VideoProvider from "./VideoProvider.js";
import youtubeProvider from "./youtubeProvider.js";


const videoProviders: Record<VideoService, VideoProvider> = {
    youtube: youtubeProvider
};

/** True only for the services in `videoProviders`, not for keys inherited from Object.prototype such as `toString` */
export function isSupportedService(service: string): service is VideoService {
    return Object.hasOwn(videoProviders, service);
}

export default videoProviders;
