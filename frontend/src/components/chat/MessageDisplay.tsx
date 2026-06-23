import { useEffect, useRef } from "react";
import Message from "./Message";
import type ChatMessage from "../../interfaces/ChatMessage";


interface MessageDisplayProps {
    messages: ChatMessage[];
}


export default function MessageDisplay({ messages }: MessageDisplayProps) {
    const lastMessageRef = useRef<HTMLDivElement | null>(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
        lastMessageRef.current?.scrollIntoView({ behavior: isFirstRender.current ? "auto" : "smooth" });
        isFirstRender.current = false;
    }, [messages]);

    return (
        <div className="w-full mb-2 overflow-y-auto overscroll-none">
            {
                messages.map((message: ChatMessage, i: number) => (
                    <Message ref={i === messages.length - 1 ? lastMessageRef : null} key={message.id} message={message} />
                ))
            }
        </div>
    );
}