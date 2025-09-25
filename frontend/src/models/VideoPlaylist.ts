import type { PlaylistState } from "../interfaces/States";

export default class Playlist {
    private items: string[] = [];
    private currentIndex: number = -1;
    private isLooping: boolean = false;

    public add(item: string) {
        this.items.push(item);
    };


    public next() {
        // Return if playlist is empty
        if (this.items.length === 0) return;

        // Return if not looping and at end of playlist
        if (!this.isLooping && this.currentIndex === this.items.length - 1) return;

        // Move to next item
        if (this.isLooping) {
            this.currentIndex = (this.currentIndex + 1) % this.items.length;
        } else {
            this.currentIndex++;
        }
    };


    public sync(state: PlaylistState) {
        this.items = state.items;
        this.currentIndex = state.currentIndex;
        this.isLooping = state.isLooping;
    }


    get current(): string {
        return this.items[this.currentIndex];
    }


    get length(): number {
        return this.items.length;
    }


    public getPlaylist(): string[] {
        return [ ...this.items ];
    };


    public getCurrentIndex(): number {
        return this.currentIndex;
    }


}