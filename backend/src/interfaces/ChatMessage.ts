export default interface ChatMessage {
    id: string;
    author: string;
    authorIcon?: string | undefined;
    text: string;
    timestamp: number;
    isSystemMessage: boolean;
}