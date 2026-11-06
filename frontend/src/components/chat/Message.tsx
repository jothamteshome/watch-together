import UserIcon from "../user/UserIcon";
import type ChatMessage from "@shared/interfaces/ChatMessage";


const SYSTEM_EVENT_TEXT: Record<NonNullable<ChatMessage["systemEvent"]>, string> = {
    joined: "has joined the room.",
    left: "has left the room.",
    disconnected: "has disconnected from the room."
};


interface MessageMetadataProps {
    author?: string;
    timestamp: number;
}


interface MessageTextProps {
    messageText: string;
}


interface ContentColumnProps {
    author?: string;
    timestamp: number;
    messageText: string;
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


function formatTimestamp(timestamp: number): string {
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

    return `${formattedDateString} ${formattedTimeString}`;
}


function MessageMetadata({ author, timestamp }: MessageMetadataProps) {
    return (
        <div className="w-full flex items-end py-1 text-white">
            { author && <p className="leading-none break-all">{author}</p>}
            <p className="text-xs text-neutral-400 ml-2 break-all">{formatTimestamp(timestamp)}</p>
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


function ContentColumn({ author, timestamp, messageText, showHeader }: ContentColumnProps) {
    return (
        <div className="flex-1 flex-col">
            {showHeader && <MessageMetadata author={author} timestamp={timestamp} />}
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
    // System messages are about a real user (msg.user) and render as a small centered note
    if (message.systemEvent) {
        return (
            <div
                ref={ref}
                title={formatTimestamp(message.timestamp)}
                className="w-full mt-2 px-2 text-center text-xs italic text-neutral-400 break-words"
            >
                {`${message.user.username} ${SYSTEM_EVENT_TEXT[message.systemEvent]}`}
            </div>
        );
    }

    const spacingStyle = showHeader ? "mt-4" : "mt-0.5";

    return (
        <div ref={ref} className={`w-full flex ${spacingStyle}`}>
            <IconColumn authorIcon={message.user.icon} showHeader={showHeader} />
            <ContentColumn author={message.user.username} timestamp={message.timestamp} messageText={message.text ?? ""} showHeader={showHeader} />
        </div>
    );
}
