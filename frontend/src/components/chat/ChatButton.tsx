import { useEffect, useRef, useState } from "react";
import { MessageSquareText } from "lucide-react";
import Chat from "./Chat";
import useClickOutside from "../../hooks/useClickOutside";
import type ChatMessage from "../../interfaces/ChatMessage";


interface ChatButtonProps {
    messages: ChatMessage[];
    notifications: number;
    clearNotifications: () => void;
    sendMessage: (msg: string) => void;
    onOpenChange: (isOpen: boolean) => void;
}


export default function ChatButton({ messages, notifications, clearNotifications, sendMessage, onOpenChange }: ChatButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useClickOutside(containerRef, () => setIsOpen(false), isOpen);

    // Reports every change regardless of cause (toggle click or click-outside),
    // so the parent's notification logic always reflects the real open state.
    useEffect(() => {
        onOpenChange(isOpen);
    }, [isOpen, onOpenChange]);

    const toggleOpen = () => {
        if (!isOpen) clearNotifications();
        setIsOpen((prev) => !prev);
    };

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                title="Open Chat"
                onClick={toggleOpen}
                className={`relative p-2 rounded-full hover:bg-gray-100/10 cursor-pointer ${isOpen ? "bg-gray-100/10" : ""}`}
            >
                <MessageSquareText className="w-5 h-5 text-gray-300" />
                {notifications > 0 && (
                    <div className="min-w-5 h-5 p-1 flex justify-center items-center -top-1 -right-1 absolute rounded-full bg-red-500 text-xs">
                        {notifications}
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 h-128 bg-neutral-900 border-white/40 border-1 rounded-lg p-2 z-20">
                    <Chat messages={messages} sendMessage={sendMessage} />
                </div>
            )}
        </div>
    );
}
