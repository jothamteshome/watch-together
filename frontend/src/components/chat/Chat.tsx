import ChatInput from "./ChatInput";
import MessageDisplay from "./MessageDisplay";
import type ChatMessage from "../../interfaces/ChatMessage";


interface ChatProps {
    messages: ChatMessage[];
    sendMessage: (msg: string) => void;
}


export default function Chat({ messages, sendMessage }: ChatProps) {
    return (
        <div className="w-full h-full flex flex-col overflow-none justify-end rounded-xl">
            <MessageDisplay messages={messages} />
            <ChatInput onSend={sendMessage}/>
        </div>
    );
}