import { vi } from "vitest";


export const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;


/**
 * Stands in for YT.Player. Calls are recorded, time/rate/state are plain fields a test can set,
 * and `ready`/`changeState` fire the callbacks the manager registered, as the iframe API would.
 */
export class FakePlayer {
    static instances: FakePlayer[] = [];

    time = 0;
    rate = 1;
    state: number = PlayerState.UNSTARTED;
    readonly loadVideoById = vi.fn((_videoId: string, startSeconds?: number) => { this.time = startSeconds ?? 0; });
    readonly seekTo = vi.fn((seconds: number) => { this.time = seconds; });
    readonly setPlaybackRate = vi.fn((rate: number) => { this.rate = rate; });
    readonly playVideo = vi.fn();
    readonly pauseVideo = vi.fn();
    readonly destroy = vi.fn();
    readonly containerId: string;
    private readonly options: YT.PlayerOptions;


    constructor(containerId: string, options: YT.PlayerOptions) {
        this.containerId = containerId;
        this.options = options;
        FakePlayer.instances.push(this);
    }


    getCurrentTime(): number { return this.time; }
    getPlaybackRate(): number { return this.rate; }
    getPlayerState(): number { return this.state; }


    ready(): void {
        this.options.events?.onReady?.({ target: this } as unknown as YT.PlayerEvent);
    }


    changeState(state: number): void {
        this.state = state;
        this.options.events?.onStateChange?.({ target: this, data: state } as unknown as YT.OnStateChangeEvent);
    }
}


/** Installs the fake iframe API as the global `YT`; vi.unstubAllGlobals removes it */
export function installYoutube(): void {
    FakePlayer.instances = [];
    vi.stubGlobal("YT", { Player: FakePlayer, PlayerState });
}


export function latestPlayer(): FakePlayer {
    const player = FakePlayer.instances.at(-1);
    if (!player) throw new Error("No YT.Player has been created");
    return player;
}
