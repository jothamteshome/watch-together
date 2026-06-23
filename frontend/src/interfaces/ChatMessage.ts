export default interface ChatMessage {
    id: string;
    author: string;
    authorIcon?: string;
    authorId?: string;
    text: string;
    timestamp: number;
    isSystemMessage: boolean;
}