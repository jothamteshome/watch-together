import { ThumbsUp, ThumbsDown } from "lucide-react";
import ChannelInfo from "./ChannelInfo";
import { formatCount } from "../../utils/formatVideoInfo";
import type { VideoChannelInfo } from "@shared/interfaces/VideoInfo";

/**
 * Props for VideoLikes component.
 */
interface VideoLikesProps {
    likeCount: number | null;
}


/**
 * Props for VideoStats component.
 */
interface VideoStatsProps {
    likeCount?: number | null;
    channel?: VideoChannelInfo;
}


/**
 * Renders video likes.
 */
function VideoLikes({ likeCount }: VideoLikesProps) {
    return (
        <div className="flex h-9 bg-neutral-800 items-center rounded-full">
            <button className="flex items-center h-full hover:bg-neutral-700 rounded-l-full cursor-not-allowed">
                <ThumbsUp className="ml-2 size-5 stroke-1"></ThumbsUp>
                <p className="mx-2 font-medium text-[0.925rem]">{formatCount(likeCount ?? 0, 0)}</p>
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
export default function VideoStats({ likeCount, channel }: VideoStatsProps) {
    return (
        <div className="flex items-center justify-between flex-wrap mt-1">
            {channel && <ChannelInfo channel={channel} />}
            {likeCount !== undefined && <VideoLikes likeCount={likeCount} />}
        </div>
    );
}
