import type User from "./User";

export default interface ChatMessage {
    id: string;
    user: User;                                        // sender (or, for system events, the subject), as of send time
    timestamp: number;
    text?: string;                                     // present for regular messages
    systemEvent?: "joined" | "left" | "disconnected";  // present for system messages
}
