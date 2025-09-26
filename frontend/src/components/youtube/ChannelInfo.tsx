import UserIcon from "../user/UserIcon";
import { formatCount } from "../../utils/formatVideoInfo";


/**
 * Props for ChannelTitle component.
 */
interface ChannelTitleProps {
    channelTitle: string;
    subscriberCount: number;
}


/**
 * Props for ChannelInfo component.
 */
interface ChannelInfoProps {
    channelIcon: string;
    channelTitle: string;
    channelUrl: string;
    subscriberCount: number;
}


/**
 * Renders the channel's title and subscriber count.
 */
function ChannelTitle({ channelTitle, subscriberCount }: ChannelTitleProps) {
    const subscriberText = subscriberCount === 1 ? "subscriber" : "subscribers";

    return (
        <div className="flex flex-col ml-2">
            <h1 className="font-bold">{channelTitle}</h1>
            <p className="text-xs text-neutral-400 font-light">{`${formatCount(subscriberCount, 1)} ${subscriberText}`}</p>
        </div>
    );
}


/**
 * Renders channel info as a link.
 */
export default function ChannelInfo({ channelIcon, channelTitle, channelUrl, subscriberCount }: ChannelInfoProps) {
    return (
        <a className="flex items-center h-12" href={channelUrl}>
            <UserIcon src={channelIcon} />
            <ChannelTitle channelTitle={channelTitle!} subscriberCount={subscriberCount!} />
        </a>
    );
}