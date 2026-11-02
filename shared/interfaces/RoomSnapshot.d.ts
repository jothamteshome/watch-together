import type ChatMessage from "./ChatMessage";
import type User from "./User";

/** Payload for `room:sync` events, sent to a client when it joins a room */
export default interface RoomSnapshot {
    users: Record<string, User>;
    chatHistory: ChatMessage[];
}
