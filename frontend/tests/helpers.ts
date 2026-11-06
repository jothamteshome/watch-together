import { vi } from "vitest";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type RoomSnapshot from "@shared/interfaces/RoomSnapshot";
import type { PlaylistState, VideoState } from "@shared/interfaces/States";
import type User from "@shared/interfaces/User";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";


export const ROOM_ID = "room1234";
export const BACKEND_URL = "http://backend.test";

export const VIDEO_A = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
export const VIDEO_B = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
export const VIDEO_C = "https://www.youtube.com/watch?v=ccccccccccc";
export const UNSUPPORTED_URL = "https://vimeo.com/123456";

/** This browser's profile; seedProfile() stores it so joining never fetches one */
export const SELF_USER: User = { id: "self-user-id", username: "SelfUser", icon: "https://example.test/self.png" };
export const OTHER_USER: User = { id: "other-user-id", username: "OtherUser", icon: "https://example.test/other.png" };


/** A fixed response, or an Error to make fetch reject */
export type Route = { status?: number; body?: unknown } | Error;


/**
 * Points the app at BACKEND_URL and replaces fetch with a router keyed by path.
 * Unrouted paths answer 404. An error status without a body answers `{ error }`, as the backend does,
 * so code that ignores `response.ok` can't pass by parsing a null body.
 * vi.unstubAllGlobals / vi.unstubAllEnvs undo both.
 */
export function stubFetch(routes: Record<string, Route> = {}) {
    vi.stubEnv("VITE_APP_BACKEND_URL", BACKEND_URL);

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const route = routes[String(input).replace(BACKEND_URL, "")];
        if (route instanceof Error) throw route;
        const status = route?.status ?? (route ? 200 : 404);
        const body = route?.body ?? (status >= 400 ? { error: `Stubbed ${status}` } : null);
        return Response.json(body, { status });
    });

    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}


/** Stores `user` as this browser's profile, as identity.ts does once one has been generated */
export function seedProfile(user: User = SELF_USER): void {
    localStorage.setItem("watch-together:profile", JSON.stringify(user));
}


export function videoInfo(title: string): VideoInfo {
    return { service: "youtube", title, channel: { name: `${title} channel` } };
}


/** A queued video. Its id comes from the URL, so a second copy of one URL needs its own `id` */
export function playlistItem(videoUrl: string, overrides: Partial<PlaylistItem> = {}): PlaylistItem {
    return { id: `item-${videoUrl.slice(-3)}`, videoUrl, videoService: "youtube", addedBy: OTHER_USER, ...overrides };
}


/** A playing video; `itemId` follows `videoUrl` unless overridden, matching playlistItem() */
export function videoState(overrides: Partial<VideoState> = {}): VideoState {
    const videoUrl = overrides.videoUrl !== undefined ? overrides.videoUrl : VIDEO_A;
    return {
        eventId: 1,
        itemId: videoUrl ? playlistItem(videoUrl).id : null,
        videoUrl,
        videoService: "youtube",
        currentTime: 0,
        isPlaying: true,
        playbackRate: 1,
        lastUpdate: 0,
        ...overrides
    };
}


export function playlistState(overrides: Partial<PlaylistState> = {}): PlaylistState {
    return { eventId: 1, items: [playlistItem(VIDEO_A)], currentIndex: 0, isLooping: false, ...overrides };
}


export function chatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
        id: crypto.randomUUID(),
        user: OTHER_USER,
        text: "hello",
        timestamp: Date.UTC(2026, 0, 1),
        ...overrides
    };
}


/** The room:sync a joiner of an empty room gets, with both users in it */
export function roomSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
    return {
        users: { [SELF_USER.id]: SELF_USER, [OTHER_USER.id]: OTHER_USER },
        chatHistory: [],
        video: videoState({ eventId: 0, videoUrl: null, videoService: null, isPlaying: false }),
        playlist: playlistState({ eventId: 0, items: [], currentIndex: -1 }),
        ...overrides
    };
}
