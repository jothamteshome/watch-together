import type { VideoInfo } from "@shared/interfaces/VideoInfo";
import VideoInfoSection from "./VideoInfo";
import VideoDescription from "./VideoDescription";


interface VideoMetadataPanelProps {
    videoData?: VideoInfo;
}


/**
 * Renders video metadata (title, channel info, description).
 * The player frame itself is handled by VideoPlayer.
 */
export default function VideoMetadataPanel({ videoData }: VideoMetadataPanelProps) {
    if (!videoData) return null;

    return (
        <>
            <VideoInfoSection
                title={videoData.title}
                likeCount={videoData.likeCount}
                channel={videoData.channel}
            />
            <VideoDescription
                description={videoData.description}
                publishedAt={videoData.publishedAt}
                viewCount={videoData.viewCount}
            />
        </>
    );
}
