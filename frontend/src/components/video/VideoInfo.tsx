import VideoStats from "./VideoStats";
import type { VideoChannelInfo } from "@shared/interfaces/VideoInfo";


/**
 * Props for VideoTitle component.
 */
interface VideoTitleProps {
    title?: string;
}


/**
 * Props for VideoInfo component.
 */
interface VideoInfoProps {
    title?: string;
    likeCount?: number | null;
    channel?: VideoChannelInfo;
}


/**
 * Renders video title.
 */
function VideoTitle({ title }: VideoTitleProps) {
    if (!title) return null;

    return (
        <h1 className="font-bold text-xl">
            {title}
        </h1>
    );
}


/**
 * Renders video info including title and stats.
 */
export default function VideoInfo({ likeCount, title, channel }: VideoInfoProps) {
    return (
        <div className="mt-1">
            <VideoTitle title={title} />
            <VideoStats
                likeCount={likeCount}
                channel={channel}
             />
        </div>
    );
}
