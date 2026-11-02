import type ChatMessage from "@shared/interfaces/ChatMessage";
import type { PlaylistState, VideoState } from "@shared/interfaces/States";
import type User from "@shared/interfaces/User";

const MAX_CHAT_HISTORY = 200;

export interface RoomUserEntry {
    user: User;
    socketIds: Record<string, true>;
}


export default class RoomState {
    private playlistState: PlaylistState | null = null;
    private videoState: VideoState | null = null;
    private users: Record<string, RoomUserEntry> = {};
    private chatHistory: ChatMessage[] = [];
    private deleteTimeoutId: NodeJS.Timeout | null = null;


    public addChatMessage(msg: ChatMessage) {
        this.chatHistory.push(msg);
        if (this.chatHistory.length > MAX_CHAT_HISTORY) {
            this.chatHistory.shift();
        }
    }

    public getChatHistory(): ChatMessage[] {
        return [ ...this.chatHistory ];
    }


    public addUser(user: User, socketId: string) {
        const existingUser: RoomUserEntry | undefined = this.users[user.id];

        if (!existingUser) {
            const newUser: RoomUserEntry = {user, socketIds: {[socketId]: true}};
            this.users[user.id] = newUser;
        } else if (!Object.hasOwn(existingUser.socketIds, socketId)) {
            existingUser.user = user;
            existingUser.socketIds[socketId] = true;
        }

        this.cancelScheduledDeletion();
    }

    public hasUser(userId: string): boolean {
        return Object.hasOwn(this.users, userId);
    }

    public removeUser(userId: string, socketId: string): boolean {
        const existingUser: RoomUserEntry | undefined = this.users[userId];

        if (!existingUser) {
            return false;
        }
        else if (!Object.hasOwn(existingUser.socketIds, socketId)) {
            return false;
        } else {
            delete existingUser.socketIds[socketId];

            if (Object.keys(existingUser.socketIds).length === 0) {
                delete this.users[userId];
            }

            return true;
        }
    }

    /**
     * Replaces the room's copy of a user's profile. Takes a whole new User rather than
     * editing the stored one, since chat messages still reference the old object.
     */
    public updateUser(user: User) {
        const existingUser: RoomUserEntry | undefined = this.users[user.id];
        if (existingUser) existingUser.user = user;
    }

    public getUsers(): Record<string, User> {
        return Object.fromEntries(Object.entries(this.users).map(([id, e]) => [id, e.user]));
    }

    public getUserCount(): number {
        return Object.keys(this.users).length;
    }

    public scheduleDeletion(callback: () => void, delayMs: number) {
        this.cancelScheduledDeletion();
        this.deleteTimeoutId = setTimeout(callback, delayMs);
    }

    public cancelScheduledDeletion() {
        if (this.deleteTimeoutId) {
            clearTimeout(this.deleteTimeoutId);
            this.deleteTimeoutId = null;
        }
    }

    public getVideoState(): VideoState | null {
        return this.videoState;
    }

    public setVideoState(state: VideoState) {
        this.videoState = state;
    }

    public getPlaylistState(): PlaylistState | null {
        return this.playlistState;
    }

    public setPlaylistState(state: PlaylistState) {
        this.playlistState = state;
    }
}
