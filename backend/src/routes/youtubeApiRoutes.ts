import { Router } from "express";
import { serverManager } from "../models/RoomManager.js";
import type { VideoData, ChannelData } from "../interfaces/VideoData.js";

const router = Router();


/**  Generic function to fetch data from Youtube Data API v3 */
async function fetchFromYoutube<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    // Get Youtube Data API v3 API Key
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY in environment");

    // Format query params as string
    const query = new URLSearchParams({ ...params, key: apiKey }).toString();

    // Get response from endpoint
    const response = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}?${query}`);
    if (!response.ok) throw new Error(`YouTube API error: ${response.statusText}`);

    // Return endpoint data as promise
    return response.json() as Promise<T>
}


/**  Get channel data from Youtube Data API v3 */
const getChannelData = async (channelId: string): Promise<ChannelData> => {
    // Get data from channels endpoint
    const data = await fetchFromYoutube<any>("channels", {
        part: "snippet,contentDetails,statistics",
        id: channelId
    });
    
    // Extract item data
    const item = data.items[0];

    // Build channel data object
    const channelData: ChannelData = {
        channelIcon: item.snippet.thumbnails.default.url,
        channelTitle: item.snippet.title,
        channelUrl: `https://www.youtube.com/channel/${channelId}`,
        subscriberCount: Number.parseInt(item.statistics.subscriberCount)
    }

    return channelData;
};


/** Get  video data from Youtube Data API v3 */
const getVideoData = async (videoId: string): Promise<VideoData> => {
    // Get data from videos endpoint
    const data = await fetchFromYoutube<any>("videos", {
        part: "snippet,contentDetails,statistics",
        id: videoId
    });

    // Extract item data
    const item = data.items[0];

    // Get channel data from API
    const channelId = item.snippet.channelId;
    const channelData = await getChannelData(channelId);


    // Build video data object
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
}


/** Route to get video data from Youtube Data API v3 */
router.get("/video/:videoId", async (req, res) => {
    const { videoId } = req.params;

    if (serverManager.videoCache.has(videoId)) {
        res.json(serverManager.videoCache.get(videoId));
        return;
    }

    try {
        // Collect new video data from Youtube API
        const videoData: VideoData = await getVideoData(videoId);

        // Update cache with new video data
        serverManager.videoCache.set(videoId, videoData);

        // Set a timeout to delete the cached video data after 1 hour
        setTimeout(() => {
            serverManager.videoCache.delete(videoId);
        }, 1000 * 60 * 60)

        res.json(videoData);
    } catch {
        console.error("Error retrieving data from Youtube Data API v3");
        res.status(500).json({ error: "Failed to fetch video data" })
    }

});


export default router;