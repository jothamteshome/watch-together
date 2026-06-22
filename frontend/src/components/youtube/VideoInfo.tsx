import VideoStats from "./VideoStats";


/**
 * Props for VideoTitle component.
 */
interface VideoTitleProps {
    videoTitle: string;
}


/**
 * Props for VideoInfo component.
 */
interface VideoInfoProps {
    videoTitle: string;
    videoLikeCount: number | null;
    channelIcon: string;
    channelTitle: string;
    channelUrl: string;
    subscriberCount: number | null;
}


/**
 * Renders video title.
 */
function VideoTitle({ videoTitle }: VideoTitleProps) {
    return (
        <h1 className="font-bold text-xl">
            {videoTitle}
        </h1>
    );
}


/**
 * Renders video info including title and stats.
 */
export default function VideoInfo({ videoLikeCount, videoTitle, channelIcon, channelTitle, channelUrl, subscriberCount }: VideoInfoProps) {
    return (
        <div className="mt-2">
            <VideoTitle videoTitle={videoTitle} />
            <VideoStats
                videoLikeCount={videoLikeCount}
                channelIcon={channelIcon}
                channelTitle={channelTitle}
                channelUrl={channelUrl}
                subscriberCount={subscriberCount}
             />
        </div>
    );
}