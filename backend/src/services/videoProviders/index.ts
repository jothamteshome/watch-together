import type { VideoService } from "@shared/interfaces/VideoService";
import type VideoProvider from "./VideoProvider.js";
import youtubeProvider from "./youtubeProvider.js";


const videoProviders: Record<VideoService, VideoProvider> = {
    youtube: youtubeProvider
};

export default videoProviders;
