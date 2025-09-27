import UserIcon from "../user/UserIcon";
import type ChatMessage from "../../interfaces/ChatMessage";


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
}


interface IconColumnProps {
    authorIcon?: string;
}


interface ChatMessageProps {
    ref: React.RefObject<HTMLDivElement | null> | null;
    message: ChatMessage;
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
        <div className="w-full text-neutral-400 whitespace-pre-wrap">
            {messageText}
        </div>
    );
}


function ContentColumn({ author, timestamp, messageText, isSystemMessage }: ContentColumnProps) {
    return (
        <div className="flex-1 flex-col">
            <MessageMetadata author={author} timestamp={timestamp} isSystemMessage={isSystemMessage} />
            <MessageText messageText={messageText} />
        </div>
    );
}


function IconColumn({ authorIcon }: IconColumnProps) {
    return (
        <div className="w-10 h-full mx-2">
            {
                authorIcon && <UserIcon src={authorIcon} />
            }
        </div>
    );
}


export default function Message({ message, ref }: ChatMessageProps) {
    return (
        <div ref={ref} className="w-full flex mt-4">
            <IconColumn authorIcon={message.authorIcon} />  
            <ContentColumn author={message.author} timestamp={message.timestamp} messageText={message.text} isSystemMessage={message.isSystemMessage} />
        </div>
    );
}