import { readFileSync } from "node:fs";
import { expect, test as base, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import type { PlaylistState } from "@shared/interfaces/States";
import { BACKEND_URL } from "./servers";

export { expect };


export const VIDEO_A = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
export const VIDEO_B = "https://www.youtube.com/watch?v=bbbbbbbbbbb";
export const VIDEO_C = "https://www.youtube.com/watch?v=ccccccccccc";
/** The video API answers 500 for this one */
export const VIDEO_WITHOUT_METADATA = "https://www.youtube.com/watch?v=fail0000001";
/** 14 videos whose fixture titles are long enough to wrap */
export const LONG_VIDEOS = Array.from({ length: 14 }, (_, i) => `https://www.youtube.com/watch?v=long${String(i).padStart(7, "0")}`);

export const PlayerState = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const;

const TITLES: Record<string, string> = { aaaaaaaaaaa: "Video A", bbbbbbbbbbb: "Video B", ccccccccccc: "Video C" };
const FAKE_IFRAME_API = readFileSync(new URL("./fake-iframe-api.js", import.meta.url), "utf-8");
const PLACEHOLDER_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#555"/></svg>`;


export interface PlayerSnapshot {
    videoId: string | null;
    state: number;
    time: number;
    loads: { videoId: string; startSeconds: number }[];
}

declare global {
    interface Window {
        /** Exposed by fake-iframe-api.js */
        __yt: { snapshot(): PlayerSnapshot | null; play(): void; pause(): void; end(): void };
        /** Read by fake-iframe-api.js: loaded videos stay paused, as when the browser blocks autoplay */
        __ytAutoplayBlocked?: boolean;
    }
}


function videoMetadata(id: string) {
    const title = TITLES[id] ?? (id.startsWith("long") ? `${"An extremely long video title that keeps on going ".repeat(4)}${id}` : `Video ${id}`);
    return {
        service: "youtube",
        title,
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        description: "Fixture description.\nIt has a second line.",
        publishedAt: Date.UTC(2025, 0, 1),
        viewCount: 12345,
        likeCount: 678,
        channel: { name: `Channel ${id}`, icon: `https://yt3.ggpht.com/${id}`, url: `https://www.youtube.com/channel/${id}`, subscriberCount: 1000 }
    };
}


/** Keeps every test offline: YouTube, its images and avatars are faked, and nothing else external loads */
async function routeExternals(context: BrowserContext) {
    await context.route(url => !/^http:\/\/127\.0\.0\.1:/.test(url.href), route => route.abort());
    await context.route(/^https:\/\/(i\.ytimg\.com|yt3\.ggpht\.com|api\.dicebear\.com)\//, route =>
        route.fulfill({ contentType: "image/svg+xml", body: PLACEHOLDER_IMAGE }));
    await context.route("https://www.youtube.com/iframe_api", route =>
        route.fulfill({ contentType: "text/javascript", body: FAKE_IFRAME_API }));
    await context.route(`${BACKEND_URL}/v1/video-api/youtube/video/*`, route => {
        const id = new URL(route.request().url()).pathname.split("/").at(-1)!;
        const headers = { "access-control-allow-origin": "*" };
        if (id.startsWith("fail")) return route.fulfill({ status: 500, headers, json: { error: "Failed to fetch video data" } });
        return route.fulfill({ headers, json: videoMetadata(id) });
    });
}


/** Resolves with the next payload of `event`, or rejects after `timeoutMs` */
function nextEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
        socket.once(event, (payload: T) => {
            clearTimeout(timer);
            resolve(payload);
        });
    });
}


/** A browserless room member that drives the room through the real backend */
export interface Seeder {
    /** Adds each URL to the playlist, one confirmed playlist:sync at a time */
    add(urls: string[]): Promise<void>;
    select(index: number): Promise<PlaylistState>;
    chat(msg: string): void;
}


interface Fixtures {
    /** Opens another member: a fresh browser context with the same device settings and routes */
    openUser: () => Promise<Page>;
    /** Creates a room through the backend's REST route */
    createRoom: () => Promise<string>;
    /** Joins `roomId` with a Seeder; it disconnects when the test ends */
    seeder: (roomId: string) => Promise<Seeder>;
}


// Playwright calls each fixture's second argument `use`; it's named `provide` here so the
// React hooks lint rule doesn't mistake it for a hook
export const test = base.extend<Fixtures>({
    context: async ({ context }, provide) => {
        await routeExternals(context);
        await provide(context);
    },

    openUser: async ({ browser }, provide, testInfo) => {
        const contexts: BrowserContext[] = [];
        await provide(async () => {
            const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId } = testInfo.project.use;
            const context = await browser.newContext({ baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, timezoneId });
            contexts.push(context);
            await routeExternals(context);
            return context.newPage();
        });
        await Promise.all(contexts.map(context => context.close()));
    },

    createRoom: async ({ request }, provide) => {
        await provide(async () => {
            const response = await request.post(`${BACKEND_URL}/v1/rooms/create-room`);
            const { roomId } = await response.json() as { roomId: string };
            return roomId;
        });
    },

    // eslint-disable-next-line no-empty-pattern -- Playwright requires an object pattern here
    seeder: async ({}, provide) => {
        const clients: Socket[] = [];
        await provide(async (roomId: string) => {
            const client = io(BACKEND_URL, { path: "/v1/socket-io", transports: ["websocket"], forceNew: true, reconnection: false });
            clients.push(client);
            await nextEvent(client, "connect");

            const joined = nextEvent(client, "chat:sync");
            client.emit("room:join", { roomId });
            await joined;

            return {
                async add(urls) {
                    for (const videoUrl of urls) {
                        const synced = nextEvent(client, "playlist:sync");
                        client.emit("playlist:add", { roomId, videoUrl });
                        await synced;
                    }
                },
                select(index) {
                    const synced = nextEvent<PlaylistState>(client, "playlist:sync");
                    client.emit("playlist:select", { roomId, index });
                    return synced;
                },
                chat(msg) {
                    client.emit("chat:message", { roomId, msg });
                }
            };
        });
        for (const client of clients) client.disconnect();
    }
});


export function chatButton(page: Page): Locator {
    return page.getByTitle("Open Chat");
}


/** Opens and closes the chat, which clears the unread badge */
export async function readChat(page: Page) {
    await chatButton(page).click();
    await chatButton(page).click();
}


/**
 * Waits until this page has joined its room. The server sends video:sync, playlist:sync and then
 * the "has joined" chat message, so once that message shows, the join state has been applied.
 */
export async function waitUntilJoined(page: Page) {
    await chatButton(page).click();
    await expect(page.getByText(/has joined the room\.$/).first()).toBeVisible();
    await chatButton(page).click();
}


export async function enterRoom(page: Page, roomId: string) {
    await page.goto(`/room/${roomId}`);
    await waitUntilJoined(page);
}


export async function queueVideo(page: Page, videoUrl: string) {
    const search = page.getByPlaceholder("Enter a url...");
    await search.fill(videoUrl);
    await search.press("Enter");
}


export function playerOf(page: Page): Promise<PlayerSnapshot | null> {
    return page.evaluate(() => window.__yt?.snapshot() ?? null);
}


/** Each playlist row's marker: its position number, or "▶" for the row being watched */
export function playlistMarkers(page: Page): Promise<string[]> {
    return page.locator("h1[title]").evaluateAll(titles => titles.map(title => {
        const marker = title.parentElement!.parentElement!.firstElementChild!;
        return marker.tagName === "P" ? marker.textContent! : "▶";
    }));
}


export async function boxOf(locator: Locator) {
    const box = await locator.boundingBox();
    if (!box) throw new Error(`${locator} has no bounding box`);
    return box;
}
