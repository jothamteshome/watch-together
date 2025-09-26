import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";


interface ChatInputProps {
    onSend: (msg: string) => void;
}


export default function ChatInput({ onSend }: ChatInputProps) {
    const [message, setMessage] = useState<string>("");
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);


    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== "Enter") return;

        if (!e.shiftKey) {
            // If enter is pressed without shift, send the message
            e.preventDefault();
            if (message.trim() === "") return;

            onSend(message.trim());
            setMessage("");
        } else {
            // Insert newline character if Shift + Enter
            const textarea = textareaRef.current;
            if (!textarea) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = message.slice(0, start) + "\n" + message.slice(end);
            setMessage(value);

            // Move cursor
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 1;
            }, 0);
        }
    }


    return (
        <textarea
            ref={textareaRef}
            value={message}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={4}
            className="w-full bg-white rounded-sm resize-none text-black my-2 p-1" />
    );
}