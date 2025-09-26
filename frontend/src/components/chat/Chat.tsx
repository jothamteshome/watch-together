interface ChatProps {
    showChat: boolean;
}

export default function Chat({ showChat }: ChatProps) {
    const hideChatStyle: string = showChat ? "flex": "hidden";

    return (
        <div className={`w-full h-full ${hideChatStyle} flex-col overflow-y-auto`}>
            <p>Hello World</p>
        </div>
    );
}