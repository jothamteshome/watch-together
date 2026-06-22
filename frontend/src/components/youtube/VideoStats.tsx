import { ThumbsUp, ThumbsDown } from "lucide-react";
import ChannelInfo from "./ChannelInfo";
import { formatCount } from "../../utils/formatVideoInfo";

/**
 * Props for VideoLikes component.
 */
interface VideoLikesProps {
    videoLikeCount: number | null;
}


/**
 * Props for VideoStats component.
 */
interface VideoStatsProps {
    videoLikeCount: number | null;
    channelIcon: string;
    channelTitle: string;
    channelUrl: string;
    subscriberCount: number | null;
}


/**
 * Renders video likes.
 */
function VideoLikes({ videoLikeCount }: VideoLikesProps) {
    return (
        <div className="flex h-9 bg-neutral-800 items-center rounded-full">
            <button className="flex items-center h-full hover:bg-neutral-700 rounded-l-full cursor-not-allowed">
                <ThumbsUp className="ml-2 size-5 stroke-1"></ThumbsUp>
                <p className="mx-2 font-medium text-[0.925rem]">{formatCount(videoLikeCount ?? 0, 0)}</p>
            </button>
            <div className="w-px h-6 bg-gray-400" />
            <button className="flex items-center justify-center h-full hover:bg-neutral-700 rounded-r-full cursor-not-allowed">
                <ThumbsDown className="mx-2 size-5 stroke-1" />
            </button>
        </div>
    );
}


/**
 * Renders video stats including channel info and likes.
 */
export default function VideoStats({ videoLikeCount, channelIcon, channelTitle, channelUrl, subscriberCount }: VideoStatsProps) {
    return (
        <div className="flex items-center justify-between flex-wrap mt-1">
            <ChannelInfo channelIcon={channelIcon} channelTitle={channelTitle} channelUrl={channelUrl} subscriberCount={subscriberCount} />
            <VideoLikes videoLikeCount={videoLikeCount} />
        </div>
    );
}