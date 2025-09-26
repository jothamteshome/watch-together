import ChatInput from "./ChatInput";
import MessageDisplay from "./MessageDisplay";
import type ChatMessage from "../../interfaces/ChatMessage";


interface ChatProps {
    messages: ChatMessage[];
    showChat: boolean;
    sendMessage: (msg: string) => void;
}


export default function Chat({ messages, showChat, sendMessage }: ChatProps) {
    const hideChatStyle: string = showChat ? "flex": "hidden";

    return (
        <div className={`w-full h-full ${hideChatStyle} flex-col overflow-none justify-end rounded-xl`}>
            <MessageDisplay messages={messages} />
            <ChatInput onSend={sendMessage}/>
        </div>
    );
}