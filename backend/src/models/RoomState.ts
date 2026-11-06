import type ChatMessage from "@shared/interfaces/ChatMessage";
import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type { PlaylistState, VideoState } from "@shared/interfaces/States";
import type User from "@shared/interfaces/User";

const MAX_CHAT_HISTORY = 200;

export interface RoomUserEntry {
    user: User;
    socketIds: Record<string, true>;
}

/**
 * What an accepted playlist change did, so the caller knows what to broadcast:
 * "queued" added or moved without touching the video, "started" loaded a video, "ended" finished the playlist
 */
export type PlaylistChange = "queued" | "started" | "ended";


export default class RoomState {
    private playlistState: PlaylistState = { eventId: 0, items: [], currentIndex: -1, isLooping: false };
    private videoState: VideoState = {
        eventId: 0,
        itemId: null,
        videoUrl: null,
        videoService: null,
        currentTime: 0,
        isPlaying: false,
        playbackRate: 1,
        lastUpdate: Date.now()
    };
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

    public getVideoState(): VideoState {
        return { ...this.videoState };
    }

    public getPlaylistState(): PlaylistState {
        return { ...this.playlistState, items: [...this.playlistState.items] };
    }


    /** Projects the playing video forward to now and re-anchors the stored state to that moment, for a joiner */
    public projectVideoState(): VideoState {
        const now = Date.now();
        if (this.videoState.isPlaying) this.videoState.currentTime += (now - this.videoState.lastUpdate) / 1000;
        this.videoState.lastUpdate = now;
        return this.getVideoState();
    }

    /**
     * Applies a client's play/pause/seek/rate change, unless it was made against an older state
     * @param isPlaying Omitted for seek and rate changes, which keep the current play state
     * @returns true if the change was applied
     */
    public updateVideo(eventId: number, time: number, playbackRate: number, isPlaying?: boolean): boolean {
        if (this.videoState.eventId > eventId) return false;

        this.videoState.eventId++;
        this.videoState.currentTime = time;
        if (isPlaying !== undefined) this.videoState.isPlaying = isPlaying;
        this.videoState.playbackRate = playbackRate;
        this.videoState.lastUpdate = Date.now();
        return true;
    }

    /** Starts a playlist item from 0:00. Only the playlist methods call this; clients never start videos */
    private loadVideoItem(item: PlaylistItem) {
        this.videoState.eventId++;
        this.videoState.itemId = item.id;
        this.videoState.videoUrl = item.videoUrl;
        this.videoState.videoService = item.videoService;
        this.videoState.currentTime = 0;
        this.videoState.isPlaying = true;
        this.videoState.playbackRate = 1;
        this.videoState.lastUpdate = Date.now();
    }


    /** Queues an item. If nothing is playing (empty or ended playlist), it also starts it */
    public addPlaylistItem(eventId: number, item: PlaylistItem): PlaylistChange | null {
        if (this.playlistState.eventId > eventId) return null;

        this.playlistState.eventId++;
        this.playlistState.items.push(item);
        if (this.playlistState.currentIndex !== -1) return "queued";

        this.playlistState.currentIndex = this.playlistState.items.length - 1;
        this.loadVideoItem(item);
        return "started";
    }

    /** Moves past the item that ended. Every client reports the end; only the first report for the current item counts */
    public advancePlaylist(endedItemId: string): PlaylistChange | null {
        const { items, currentIndex } = this.playlistState;

        // Nothing is current once the playlist has ended, so a report without an itemId can't match
        const current = items[currentIndex];
        if (!current || current.id !== endedItemId) return null;

        this.playlistState.eventId++;
        this.playlistState.currentIndex = currentIndex >= items.length - 1 ? -1 : currentIndex + 1;

        const nextItem = items[this.playlistState.currentIndex];
        if (!nextItem) return "ended";

        this.loadVideoItem(nextItem);
        return "started";
    }

    /**
     * Starts the item at `index`. Selecting the loaded item is a no-op. That includes the last item after the
     * playlist ended: a finished playlist stays on it, and the scrubber restarts it.
     */
    public selectPlaylistItem(eventId: number, index: number): PlaylistChange | null {
        if (this.playlistState.eventId > eventId) return null;

        const item = this.playlistState.items[index];
        if (!item || item.id === this.videoState.itemId) return null;

        this.playlistState.eventId++;
        this.playlistState.currentIndex = index;
        this.loadVideoItem(item);
        return "started";
    }
}
