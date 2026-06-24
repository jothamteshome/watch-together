import type { VideoService } from "./VideoService";


/** Interface for channel/creator info; omitted for services with no such concept */
export interface VideoChannelInfo {
    name: string;
    icon?: string;
    url?: string;
    subscriberCount?: number | null;
};


/** Interface for video metadata shared across services; fields a service doesn't support are omitted */
export interface VideoInfoBase {
    service: VideoService;
    title?: string;
    thumbnail?: string;
    description?: string;
    publishedAt?: number | null;
    viewCount?: number | null;
    likeCount?: number | null;
    channel?: VideoChannelInfo;
};


/** Interface for YouTube-specific video info returned by the video-api backend route */
export interface YoutubeVideoInfo extends VideoInfoBase {
    service: "youtube";
};


export type VideoInfo = YoutubeVideoInfo;
