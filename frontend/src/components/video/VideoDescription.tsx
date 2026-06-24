import { useState } from "react";
import { formatCount, formatRelativeDate, formatExactCount, formatExactDate } from "../../utils/formatVideoInfo";


/**
 * Props for DescriptionStats component.
 */
interface DescriptionStatsProps {
    publishedAt?: number | null;
    viewCount?: number | null;
    descriptionExpanded: boolean;
}


/**
 * Props for VideoDescriptionText component.
 */
interface VideoDescriptionTextProps {
    description: string;
}


/**
 * Props for VideoDescription component.
 */
interface VideoDescriptionProps {
    maxChars?: number;
    description?: string;
    publishedAt?: number | null;
    viewCount?: number | null;
}


/**
 * Renders video stats (views and publish date).
 */
function DescriptionStats({ publishedAt, viewCount, descriptionExpanded }: DescriptionStatsProps) {
    const viewsText = (viewCount ?? 0) === 1 ? "view" : "views";

    const expandedDateString: string = formatExactDate(publishedAt);
    const relativeDateString: string = descriptionExpanded ? "" : formatRelativeDate(publishedAt);
    const expandedViewCount: string = `${formatExactCount(viewCount)} ${viewsText}`;

    const tooltipParts = [
        viewCount !== undefined ? expandedViewCount : null,
        expandedDateString || null
    ].filter((part): part is string => Boolean(part));

    const tooltipText = descriptionExpanded ? undefined : tooltipParts.join(" • ") || undefined;

    return (
        <div className="flex" title={tooltipText}>
            {viewCount !== undefined && (
                <p className="font-bold text-sm">{descriptionExpanded ? `${expandedViewCount}` : `${formatCount(viewCount, 1)} ${viewsText}`}</p>
            )}
            {(descriptionExpanded ? expandedDateString : relativeDateString) && (
                <p className="font-bold text-sm ml-2">{descriptionExpanded ? `${expandedDateString}` : `${relativeDateString}`}</p>
            )}
        </div>
    );
}


/**
 * Renders the video description, converting URLs to links.
 */
function VideoDescriptionText({ description }: VideoDescriptionTextProps) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let parts = description?.split(urlRegex);

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
export default function VideoDescription({ maxChars = 200, description, publishedAt, viewCount }: VideoDescriptionProps) {
    const [expanded, setExpanded] = useState(false);

    if (description === undefined && publishedAt === undefined && viewCount === undefined) return null;
    if (!description) description = "";

    const isLong = description.length > maxChars;
    const descriptionText = expanded || !isLong ? description : description?.slice(0, maxChars) + "...";

    const cursorStyle = expanded && description ? "cursor-default" : "cursor-pointer";

    return (
        <div className={`flex flex-col rounded-lg bg-neutral-800 mt-2 p-4 ${cursorStyle}`} onClick={expanded ? () => null : () => setExpanded(true)}>
            <DescriptionStats publishedAt={publishedAt} viewCount={viewCount} descriptionExpanded={expanded} />
            <VideoDescriptionText description={descriptionText} />
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
