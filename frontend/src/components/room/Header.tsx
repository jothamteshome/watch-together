import type { ChangeEvent } from "react";
import RoomInfo from "./RoomInfo";
import SearchBar from "./SearchBar";
import ChatButton from "../chat/ChatButton";
import type ChatMessage from "../../interfaces/ChatMessage";


interface HeaderProps {
    roomId: string;
    onSearchChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onSearchSubmit: () => void;
    chatMessages: ChatMessage[];
    chatNotifications: number;
    clearChatNotifications: () => void;
    sendChatMessage: (msg: string) => void;
}


export default function Header({
    roomId,
    onSearchChange,
    onSearchSubmit,
    chatMessages,
    chatNotifications,
    clearChatNotifications,
    sendChatMessage,
}: HeaderProps) {
    return (
        <div className="w-full flex items-center gap-4 px-4 py-2 border-b border-gray-800">
            <RoomInfo roomId={roomId} />
            <SearchBar onChange={onSearchChange} onClick={onSearchSubmit} />
            <ChatButton
                messages={chatMessages}
                notifications={chatNotifications}
                clearNotifications={clearChatNotifications}
                sendMessage={sendChatMessage}
            />
        </div>
    );
}
