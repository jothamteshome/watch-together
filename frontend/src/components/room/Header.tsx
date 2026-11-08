import { useMemo, type ChangeEvent } from "react";
import AppHeader from "../common/AppHeader";
import RoomInfo from "./RoomInfo";
import SearchBar from "./SearchBar";
import ChatButton from "../chat/ChatButton";
import OnlineUsersButton from "../user/OnlineUsersButton";
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
    // Ids rather than users, so a renamed author in the chat still matches
    const onlineUserIds = useMemo(() => new Set(users.map((u) => u.id)), [users]);

    return (
        <AppHeader
            user={user}
            onUpdateProfile={updateProfile}
            actions={
                <>
                    <OnlineUsersButton users={users} selfUserId={user?.id} />
                    <ChatButton
                        messages={chatMessages}
                        onlineUserIds={onlineUserIds}
                        notifications={chatNotifications}
                        clearNotifications={clearChatNotifications}
                        sendMessage={sendChatMessage}
                        onOpenChange={onChatOpenChange}
                    />
                </>
            }
        >
            <RoomInfo roomId={roomId} />
            <SearchBar onChange={onSearchChange} onClick={onSearchSubmit} />
        </AppHeader>
    );
}
