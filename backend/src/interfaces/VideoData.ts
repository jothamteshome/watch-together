/** Interface for video information pulled from Youtube Data API v3 */
export interface VideoData {
  videoDescription: string;
  videoLikeCount: number | null;
  videoPublishedAt: number | null;
  videoTitle: string;
  videoThumbnail: string;
  videoViewCount: number | null;
  channelIcon: string;
  channelTitle: string;
  channelUrl: string;
  subscriberCount: number | null;
};


/** Interface for channel information pulled from Youtube Data API v3 */
export interface ChannelData {
  channelIcon: string,
  channelTitle: string,
  channelUrl: string,
  subscriberCount: number | null
};