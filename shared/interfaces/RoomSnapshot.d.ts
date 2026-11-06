import type ChatMessage from "./ChatMessage";
import type { PlaylistState, VideoState } from "./States";
import type User from "./User";

/** Payload for `room:sync` events, sent to a client when it joins a room: users, chat, video and playlist */
export default interface RoomSnapshot {
    users: Record<string, User>;
    chatHistory: ChatMessage[];
    video: VideoState;
    playlist: PlaylistState;
}
