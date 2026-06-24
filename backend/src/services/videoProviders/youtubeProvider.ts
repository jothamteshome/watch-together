import type { VideoChannelInfo, YoutubeVideoInfo } from "@shared/interfaces/VideoInfo";
import type VideoProvider from "./VideoProvider.js";


/** Generic function to fetch data from the YouTube Data API v3 */
async function fetchFromYoutube<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY in environment");

    const query = new URLSearchParams({ ...params, key: apiKey }).toString();
    const response = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${query}`);
    if (!response.ok) throw new Error(`YouTube API error: ${response.statusText}`);

    return response.json() as Promise<T>;
}


/** Get channel data from the YouTube Data API v3 */
const getChannelInfo = async (channelId: string): Promise<VideoChannelInfo> => {
    const data = await fetchFromYoutube<any>("channels", {
        part: "snippet,contentDetails,statistics",
        id: channelId
    });

    const item = data.items[0];

    return {
        name: item.snippet.title,
        icon: item.snippet.thumbnails.default.url,
        url: `https://www.youtube.com/channel/${channelId}`,
        subscriberCount: item.statistics.subscriberCount != null ? Number.parseInt(item.statistics.subscriberCount) : null
    };
};


/** Get video data from the YouTube Data API v3 */
const getVideoInfo = async (videoId: string): Promise<YoutubeVideoInfo> => {
    const data = await fetchFromYoutube<any>("videos", {
        part: "snippet,contentDetails,statistics",
        id: videoId
    });

    const item = data.items[0];
    const channel = await getChannelInfo(item.snippet.channelId);

    return {
        service: "youtube",
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.high.url,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt ? Date.parse(item.snippet.publishedAt) : null,
        viewCount: item.statistics.viewCount != null ? Number.parseInt(item.statistics.viewCount) : null,
        likeCount: item.statistics.likeCount != null ? Number.parseInt(item.statistics.likeCount) : null,
        channel
    };
};


const youtubeProvider: VideoProvider = {
    service: "youtube",
    getVideoInfo
};

export default youtubeProvider;
