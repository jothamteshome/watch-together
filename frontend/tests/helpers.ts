import { vi } from "vitest";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type { PlaylistState, VideoState } from "@shared/interfaces/States";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";


export const ROOM_ID = "room1234";
export const BACKEND_URL = "http://backend.test";

export const VIDEO_A = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
export const VIDEO_B = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
export const VIDEO_C = "https://www.youtube.com/watch?v=ccccccccccc";
export const UNSUPPORTED_URL = "https://vimeo.com/123456";


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


export function videoInfo(title: string): VideoInfo {
    return { service: "youtube", title, channel: { name: `${title} channel` } };
}


export function videoState(overrides: Partial<VideoState> = {}): VideoState {
    return {
        eventId: 1,
        videoUrl: VIDEO_A,
        videoService: "youtube",
        currentTime: 0,
        isPlaying: true,
        playbackRate: 1,
        lastUpdate: 0,
        ...overrides
    };
}


export function playlistState(overrides: Partial<PlaylistState> = {}): PlaylistState {
    return { eventId: 1, items: [VIDEO_A], currentIndex: 0, isLooping: false, ...overrides };
}


export function chatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
        id: crypto.randomUUID(),
        author: "OtherUser",
        authorId: "other-socket-id",
        text: "hello",
        timestamp: Date.UTC(2026, 0, 1),
        isSystemMessage: false,
        ...overrides
    };
}
