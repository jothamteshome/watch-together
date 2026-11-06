import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type { PlaylistState } from "@shared/interfaces/States";

export default class Playlist {
    private items: PlaylistItem[] = [];


    public sync(state: PlaylistState) {
        this.items = state.items;
    }


    get length(): number {
        return this.items.length;
    }


    public getPlaylist(): PlaylistItem[] {
        return [ ...this.items ];
    };


}
