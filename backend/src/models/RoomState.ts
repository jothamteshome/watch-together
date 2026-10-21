import type { PlaylistState, VideoState } from "@shared/interfaces/States";


export default class RoomState {
    private playlistState: PlaylistState | null = null;
    private videoState: VideoState | null = null;
    private users: Set<string> = new Set<string>();
    private deleteTimeoutId: NodeJS.Timeout | null = null;


    public addUser(socketId: string) {
        this.users.add(socketId);
        this.cancelScheduledDeletion();
    }

    public removeUser(socketId: string) {
        this.users.delete(socketId);
    }

    public getUsers(): Set<string> {
        return this.users;
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
