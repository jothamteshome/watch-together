import type BaseVideoInfo from "./BaseVideoInfo";

/**
 * YouTube-specific video info returned by the video-api backend route.
 * Extends BaseVideoInfo (adds the "youtube" service discriminator).
 */
export default interface YoutubeVideoInfo extends BaseVideoInfo {
    videoDescription: string;
    videoLikeCount: number;
    videoPublishedAt: number;
    videoTitle: string;
    videoThumbnail: string;
    videoViewCount: number;
    channelIcon: string;
    channelTitle: string;
    channelUrl: string;
    subscriberCount: number;
}
