import { Router } from "express";
import { serverManager } from "../models/RoomManager.js";
import type { VideoData, ChannelData } from "../interfaces/VideoData.js";


const router = Router();


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
const getChannelData = async (channelId: string): Promise<ChannelData> => {
    const data = await fetchFromYoutube<any>("channels", {
        part: "snippet,contentDetails,statistics",
        id: channelId
    });

    const item = data.items[0];

    const channelData: ChannelData = {
        channelIcon: item.snippet.thumbnails.default.url,
        channelTitle: item.snippet.title,
        channelUrl: `https://www.youtube.com/channel/${channelId}`,
        subscriberCount: Number.parseInt(item.statistics.subscriberCount)
    };

    return channelData;
};


/** Get video data from the YouTube Data API v3 */
const getVideoData = async (videoId: string): Promise<VideoData> => {
    const data = await fetchFromYoutube<any>("videos", {
        part: "snippet,contentDetails,statistics",
        id: videoId
    });

    const item = data.items[0];
    const channelData = await getChannelData(item.snippet.channelId);

    const videoData: VideoData = {
        videoDescription: item.snippet.description,
        videoLikeCount: Number.parseInt(item.statistics.likeCount),
        videoPublishedAt: Date.parse(item.snippet.publishedAt),
        videoTitle: item.snippet.title,
        videoThumbnail: item.snippet.thumbnails.high.url,
        videoViewCount: Number.parseInt(item.statistics.viewCount),
        ...channelData
    };

    return videoData;
};


/** GET /youtube/video/:videoId — returns YouTube video metadata */
router.get("/youtube/video/:videoId", async (req, res) => {
    const { videoId } = req.params;
    const cacheKey = `youtube:${videoId}`;

    if (serverManager.videoCache.has(cacheKey)) {
        res.json(serverManager.videoCache.get(cacheKey));
        return;
    }

    try {
        const videoData: VideoData = await getVideoData(videoId);

        serverManager.videoCache.set(cacheKey, videoData);
        setTimeout(() => {
            serverManager.videoCache.delete(cacheKey);
        }, 1000 * 60 * 60);

        res.json(videoData);
    } catch {
        console.error("Error retrieving data from YouTube Data API v3");
        res.status(500).json({ error: "Failed to fetch video data" });
    }
});


export default router;
