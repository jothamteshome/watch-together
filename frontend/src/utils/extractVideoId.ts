import type { VideoService } from "../interfaces/VideoService";
import type VideoServiceInformation from "../interfaces/VideoServiceInformation";


/**
 * Extracts a Youtube video ID from a youtube url
 * @param parsed URL object containing information such as hostname, query parameters, etc.
 * @returns Information about the video and the youtube service identifier
 */
const extractYouTubeId = (parsed: URL): Partial<VideoServiceInformation> => {
    const service: VideoService = "youtube";
    let videoId: string | undefined;

    try {
        const hostname = parsed.hostname;

        if (hostname.includes("youtu.be")) {
            videoId = parsed.pathname.slice(1);
        } else if (hostname.includes("youtube.com")) {

            if (parsed.pathname.startsWith("/watch")) videoId = parsed.searchParams.get("v") ?? undefined;
            else if (parsed.pathname.startsWith("/shorts/")) videoId = parsed.pathname.split("/")[2];

        }

        if (!videoId || videoId.length !== 11) videoId = undefined; 

        return { videoId, service };
    } catch {
        return { videoId, service };
    }
};


/**
 * Extracts a video id for a given url and returns the id and service that url belongs to
 */
export default function extractVideoId(url: string): Partial<VideoServiceInformation> {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    if (hostname.includes("youtu.be") || hostname.includes("youtube.com")) {
        return extractYouTubeId(parsed);
    }

    return { videoId: undefined, service: undefined };
};