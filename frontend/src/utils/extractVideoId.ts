import type { VideoService } from "../interfaces/VideoService";
import type VideoServiceInformation from "../interfaces/VideoServiceInformation";


/**
 * Extracts a YouTube video ID from a YouTube URL.
 * @param parsed URL object containing information such as hostname, query parameters, etc.
 * @returns Partial VideoServiceInformation with videoIdentifier and service.
 */
const extractYouTubeId = (parsed: URL): Partial<VideoServiceInformation> => {
    const service: VideoService = "youtube";
    let videoIdentifier: string | undefined;

    try {
        const hostname = parsed.hostname;

        if (hostname.includes("youtu.be")) {
            videoIdentifier = parsed.pathname.slice(1);
        } else if (hostname.includes("youtube.com")) {

            if (parsed.pathname.startsWith("/watch")) videoIdentifier = parsed.searchParams.get("v") ?? undefined;
            else if (parsed.pathname.startsWith("/shorts/")) videoIdentifier = parsed.pathname.split("/")[2];

        }

        if (!videoIdentifier || videoIdentifier.length !== 11) videoIdentifier = undefined;

        return { videoIdentifier, service };
    } catch {
        return { videoIdentifier, service };
    }
};


/**
 * Extracts a video identifier for a given URL and returns the identifier and service that URL belongs to.
 * Used internally by service managers — prefer manager.canHandle() in application code.
 */
export default function extractVideoId(url: string): Partial<VideoServiceInformation> {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    if (hostname.includes("youtu.be") || hostname.includes("youtube.com")) {
        return extractYouTubeId(parsed);
    }

    return { videoIdentifier: undefined, service: undefined };
};