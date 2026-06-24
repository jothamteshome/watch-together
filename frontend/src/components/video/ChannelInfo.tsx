import UserIcon from "../user/UserIcon";
import { formatCount } from "../../utils/formatVideoInfo";
import type { VideoChannelInfo } from "@shared/interfaces/VideoInfo";


/**
 * Props for ChannelTitle component.
 */
interface ChannelTitleProps {
    name: string;
    subscriberCount?: number | null;
}


/**
 * Props for ChannelInfo component.
 */
interface ChannelInfoProps {
    channel: VideoChannelInfo;
}


/**
 * Renders the channel's title and subscriber count.
 */
function ChannelTitle({ name, subscriberCount }: ChannelTitleProps) {
    const subscriberText = (subscriberCount ?? 0) === 1 ? "subscriber" : "subscribers";

    return (
        <div className="flex flex-col ml-2">
            <h1 className="font-bold">{name}</h1>
            {subscriberCount !== undefined && (
                <p className="text-xs text-neutral-400 font-light">{`${formatCount(subscriberCount, 1)} ${subscriberText}`}</p>
            )}
        </div>
    );
}


/**
 * Renders channel info as a link.
 */
export default function ChannelInfo({ channel }: ChannelInfoProps) {
    return (
        <a className="flex items-center h-12" href={channel.url}>
            {channel.icon && <UserIcon src={channel.icon} />}
            <ChannelTitle name={channel.name} subscriberCount={channel.subscriberCount} />
        </a>
    );
}
