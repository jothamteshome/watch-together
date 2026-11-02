import type { ChangeEvent } from "react";
import RoomInfo from "./RoomInfo";
import SearchBar from "./SearchBar";
import ChatButton from "../chat/ChatButton";
import OnlineUsersButton from "../user/OnlineUsersButton";
import UserMenu from "../user/UserMenu";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type User from "@shared/interfaces/User";
import type { UserUpdateEvent } from "@shared/interfaces/UserEvents";


interface HeaderProps {
    roomId: string;
    onSearchChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onSearchSubmit: () => void;
    chatMessages: ChatMessage[];
    chatNotifications: number;
    clearChatNotifications: () => void;
    sendChatMessage: (msg: string) => void;
    onChatOpenChange: (isOpen: boolean) => void;
    user?: User | undefined;
    users: User[];
    updateProfile: (changes: UserUpdateEvent) => void;
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
    user,
    users,
    updateProfile,
}: HeaderProps) {
    return (
        <div className="w-full flex items-center justify-between gap-4 p-4">
            <RoomInfo roomId={roomId} />
            <SearchBar onChange={onSearchChange} onClick={onSearchSubmit} />
            <div className="flex items-center gap-1 shrink-0">
                <OnlineUsersButton users={users} selfUserId={user?.id} />
                <ChatButton
                    messages={chatMessages}
                    notifications={chatNotifications}
                    clearNotifications={clearChatNotifications}
                    sendMessage={sendChatMessage}
                    onOpenChange={onChatOpenChange}
                />
                {user && <UserMenu user={user} onUpdate={updateProfile} />}
            </div>
        </div>
    );
}
