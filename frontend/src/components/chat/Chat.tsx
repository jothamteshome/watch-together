import ChatInput from "./ChatInput";
import MessageDisplay from "./MessageDisplay";
import type ChatMessage from "@shared/interfaces/ChatMessage";


interface ChatProps {
    messages: ChatMessage[];
    onlineUserIds: Set<string>;
    sendMessage: (msg: string) => void;
}


export default function Chat({ messages, onlineUserIds, sendMessage }: ChatProps) {
    return (
        <div className="w-full h-full flex flex-col overflow-none justify-end rounded-lg">
            <MessageDisplay messages={messages} onlineUserIds={onlineUserIds} />
            <ChatInput onSend={sendMessage}/>
        </div>
    );
}