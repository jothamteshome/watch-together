import type YoutubeVideoInfo from "../../interfaces/YoutubeVideoInfo";
import VideoInfo from "../youtube/VideoInfo";
import VideoDescription from "../youtube/VideoDescription";


interface YoutubeVideoProps {
    videoData?: YoutubeVideoInfo;
}


/**
 * Renders YouTube video metadata (title, channel info, description).
 * The player frame itself is handled by VideoPlayer.
 */
export default function YoutubeVideo({ videoData }: YoutubeVideoProps) {
    if (!videoData) return null;

    return (
        <div className="w-full flex flex-col items-center">
            <div className="w-4/5 max-w-7xl flex flex-col">
                <VideoInfo
                    videoLikeCount={videoData.videoLikeCount}
                    videoTitle={videoData.videoTitle}
                    channelIcon={videoData.channelIcon}
                    channelTitle={videoData.channelTitle}
                    channelUrl={videoData.channelUrl}
                    subscriberCount={videoData.subscriberCount}
                />
                <VideoDescription
                    videoDescription={videoData.videoDescription}
                    videoPublishedAt={videoData.videoPublishedAt}
                    videoViewCount={videoData.videoViewCount}
                />
            </div>
        </div>
    );
}