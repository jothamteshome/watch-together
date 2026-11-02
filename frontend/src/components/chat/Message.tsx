import UserIcon from "../user/UserIcon";
import type ChatMessage from "@shared/interfaces/ChatMessage";


// System messages are about a real user (msg.user) but displayed as authored by [SYSTEM].
const SYSTEM_AUTHOR = "[SYSTEM]";
const SYSTEM_ICON = "https://api.dicebear.com/7.x/identicon/svg?seed=system";

const SYSTEM_EVENT_TEXT: Record<NonNullable<ChatMessage["systemEvent"]>, string> = {
    joined: "has joined the room.",
    left: "has left the room.",
    disconnected: "has disconnected from the room."
};


interface MessageMetadataProps {
    author?: string;
    timestamp: number;
    isSystemMessage: boolean;
}


interface MessageTextProps {
    messageText: string;
}


interface ContentColumnProps {
    author?: string;
    timestamp: number;
    messageText: string;
    isSystemMessage: boolean;
    showHeader: boolean;
}


interface IconColumnProps {
    authorIcon?: string;
    showHeader: boolean;
}


interface ChatMessageProps {
    ref: React.RefObject<HTMLDivElement | null> | null;
    message: ChatMessage;
    showHeader: boolean;
}


function MessageMetadata({ author, timestamp, isSystemMessage }: MessageMetadataProps) {
    const date: Date = new Date(timestamp);
    const formattedDateString: string = date.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });

    const formattedTimeString: string = date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit"
    });

    const systemAuthorStyle: string = isSystemMessage ? "text-red-500" : "text-white";

    return (
        <div className={`w-full flex items-end py-1 ${systemAuthorStyle}`}>
            { author && <p className="leading-none break-all">{author}</p>}
            <p className="text-xs text-neutral-400 ml-2 break-all">{`${formattedDateString} ${formattedTimeString}`}</p>
        </div>
    );
}


function MessageText({ messageText }: MessageTextProps) {
    return (
        <div className="w-full text-sm text-neutral-400 whitespace-pre-wrap">
            {messageText}
        </div>
    );
}


function ContentColumn({ author, timestamp, messageText, isSystemMessage, showHeader }: ContentColumnProps) {
    return (
        <div className="flex-1 flex-col">
            {showHeader && <MessageMetadata author={author} timestamp={timestamp} isSystemMessage={isSystemMessage} />}
            <MessageText messageText={messageText} />
        </div>
    );
}


function IconColumn({ authorIcon, showHeader }: IconColumnProps) {
    return (
        <div className="w-10 h-full mx-2">
            {
                showHeader && authorIcon && <UserIcon src={authorIcon} />
            }
        </div>
    );
}


export default function Message({ message, ref, showHeader }: ChatMessageProps) {
    const spacingStyle = showHeader ? "mt-4" : "mt-0.5";
    const isSystemMessage = !!message.systemEvent;

    const author = isSystemMessage ? SYSTEM_AUTHOR : message.user.username;
    const authorIcon = isSystemMessage ? SYSTEM_ICON : message.user.icon;
    const messageText = message.systemEvent
        ? `${message.user.username} ${SYSTEM_EVENT_TEXT[message.systemEvent]}`
        : message.text ?? "";

    return (
        <div ref={ref} className={`w-full flex ${spacingStyle}`}>
            <IconColumn authorIcon={authorIcon} showHeader={showHeader} />
            <ContentColumn author={author} timestamp={message.timestamp} messageText={messageText} isSystemMessage={isSystemMessage} showHeader={showHeader} />
        </div>
    );
}