export default interface ChatMessage {
    id: string;
    author: string;
    authorIcon?: string;
    text: string;
    timestamp: number;
}