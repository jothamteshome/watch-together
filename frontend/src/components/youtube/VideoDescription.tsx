import { useState } from "react";
import { formatCount, formatYoutubeDate, formatExactCount, formatExactDate } from "../../utils/formatVideoInfo";


/**
 * Props for DescriptionStats component.
 */
interface DescriptionStatsProps {
    videoPublishedAt: number | null;
    videoViewCount: number | null;
    descriptionExpanded: boolean;
}


/**
 * Props for VideoDescriptionText component.
 */
interface VideoDescriptionTextProps {
    videoDescription: string;
}


/**
 * Props for VideoDescription component.
 */
interface VideoDescriptionProps {
    maxChars?: number;
    videoDescription: string;
    videoPublishedAt: number | null;
    videoViewCount: number | null;
}


/**
 * Renders video stats (views and publish date).
 */
function DescriptionStats({ videoPublishedAt, videoViewCount, descriptionExpanded }: DescriptionStatsProps) {
    const viewsText = (videoViewCount ?? 0) === 1 ? "view" : "views";

    const expandedDateString: string = formatExactDate(videoPublishedAt);
    const relativeDateString: string = descriptionExpanded ? "" : formatYoutubeDate(videoPublishedAt);
    const expandedViewCount: string = `${formatExactCount(videoViewCount)} ${viewsText}`;

    const tooltipText = descriptionExpanded
        ? undefined
        : expandedDateString
            ? `${expandedViewCount} • ${expandedDateString}`
            : expandedViewCount;

    return (
        <div className="flex" title={tooltipText}>
            <p className="font-bold text-sm">{descriptionExpanded ? `${expandedViewCount}` : `${formatCount(videoViewCount, 1)} ${viewsText}`}</p>
            {(descriptionExpanded ? expandedDateString : relativeDateString) && (
                <p className="font-bold text-sm ml-2">{descriptionExpanded ? `${expandedDateString}` : `${relativeDateString}`}</p>
            )}
        </div>
    );
}


/**
 * Renders the video description, converting URLs to links.
 */
function VideoDescriptionText({ videoDescription }: VideoDescriptionTextProps) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let parts = videoDescription?.split(urlRegex);

    if (!parts) parts = [];

    return (
        <div className="whitespace-pre-wrap text-sm">
            {parts.map((part: string, i: number) =>
                part.match(urlRegex) ? (
                    <a key={`${part}-${i}`} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                        {part}
                    </a>
                ) : (
                    part
                )
            )}
        </div>
    );
};


/**
 * Renders the video description section with expand/collapse.
 */
export default function VideoDescription({ maxChars = 200, videoDescription, videoPublishedAt, videoViewCount }: VideoDescriptionProps) {
    const [expanded, setExpanded] = useState(false);
    if (!videoDescription) videoDescription = "";

    const isLong = videoDescription.length > maxChars;
    const videoDescriptionText = expanded || !isLong ? videoDescription : videoDescription?.slice(0, maxChars) + "...";

    const cursorStyle = expanded && videoDescription ? "cursor-default" : "cursor-pointer";

    return (
        <div className={`flex flex-col rounded-lg bg-neutral-800 mt-2 p-4 ${cursorStyle}`} onClick={expanded ? () => null : () => setExpanded(true)}>
            <DescriptionStats videoPublishedAt={videoPublishedAt} videoViewCount={videoViewCount} descriptionExpanded={expanded} />
            <VideoDescriptionText videoDescription={videoDescriptionText} />
            {
                isLong &&
                <button className="font-light text-xs cursor-pointer"
                onClick={expanded ? () => setExpanded(false) : () => null}
                >
                    {expanded ? "Show Less" : "Show More"}
                </button>
            }

        </div>
    );
}