import type { ChangeEvent } from "react";
import RoomInfo from "./RoomInfo";
import SearchBar from "./SearchBar";
import ChatButton from "../chat/ChatButton";
import type ChatMessage from "@shared/interfaces/ChatMessage";


interface HeaderProps {
    roomId: string;
    onSearchChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onSearchSubmit: () => void;
    chatMessages: ChatMessage[];
    chatNotifications: number;
    clearChatNotifications: () => void;
    sendChatMessage: (msg: string) => void;
    onChatOpenChange: (isOpen: boolean) => void;
}


export default function Header({
    roomId,
    onSearchChange,
    onSearchSubmit,
    chatMessages,
    chatNotifications,
    clearChatNotifications,
    sendChatMessage,
    onChatOpenChange,
}: HeaderProps) {
    return (
        <div className="w-full flex items-center justify-between gap-4 p-4">
            <RoomInfo roomId={roomId} />
            <SearchBar onChange={onSearchChange} onClick={onSearchSubmit} />
            <ChatButton
                messages={chatMessages}
                notifications={chatNotifications}
                clearNotifications={clearChatNotifications}
                sendMessage={sendChatMessage}
                onOpenChange={onChatOpenChange}
            />
        </div>
    );
}
