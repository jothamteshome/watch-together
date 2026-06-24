import { useEffect, useRef } from "react";
import Message from "./Message";
import type ChatMessage from "@shared/interfaces/ChatMessage";


interface MessageDisplayProps {
    messages: ChatMessage[];
}


// Consecutive messages from the same author within this window collapse under one header.
const GROUP_TIME_THRESHOLD_MS = 5 * 60 * 1000;


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
                messages.map((message: ChatMessage, i: number) => {
                    const previous = messages[i - 1];
                    const showHeader = !previous
                        || previous.isSystemMessage
                        || message.isSystemMessage
                        || previous.author !== message.author
                        || message.timestamp - previous.timestamp > GROUP_TIME_THRESHOLD_MS;

                    return (
                        <Message
                            ref={i === messages.length - 1 ? lastMessageRef : null}
                            key={message.id}
                            message={message}
                            showHeader={showHeader}
                        />
                    );
                })
            }
        </div>
    );
}