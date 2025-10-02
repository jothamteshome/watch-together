import type { PlaylistState, VideoState } from "./States";


export default class RoomState {
    private playlistState: PlaylistState | null = null;
    private videoState: VideoState | null = null;
    private users: Set<string> = new Set<string>();


    public addUser(socketId: string) {
        this.users.add(socketId);
    }

    public removeUser(socketId: string) {
        this.users.delete(socketId);
    }

    public getUsers(): Set<string> {
        return this.users
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