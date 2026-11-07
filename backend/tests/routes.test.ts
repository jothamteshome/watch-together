import { readFileSync } from "node:fs";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { serverManager } from "../src/models/RoomManager.js";
import videoProviders from "../src/services/videoProviders/index.js";
import type VideoProvider from "../src/services/videoProviders/VideoProvider.js";
import { startServer, type TestServer } from "./helpers.js";


const VIDEO_ID = "aaaaaaaaaaa";
const VIDEO_INFO: VideoInfo = { service: "youtube", title: "Video A", channel: { name: "Channel A" } };
const ONE_HOUR = 60 * 60 * 1000;

function getVideo(service: string, id = VIDEO_ID) {
    return fetch(`${server.url}/v1/video-api/${service}/video/${id}`);
}


let server: TestServer;
let getVideoInfo: MockInstance<VideoProvider["getVideoInfo"]>;

beforeAll(async () => {
    server = await startServer();
});

beforeEach(() => {
    // Tripwire: a request that slips past the spy throws on the missing key before reaching YouTube
    vi.stubEnv("YOUTUBE_API_KEY", "");
    getVideoInfo = vi.spyOn(videoProviders.youtube, "getVideoInfo").mockResolvedValue(VIDEO_INFO);
});

afterEach(() => {
    serverManager.videoCache.clear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
});

afterAll(() => server.close());


describe("GET /v1/video-api/:service/video/:id", () => {
    it("fetches a video from its provider once, then serves it from the cache", async () => {
        // Act
        const first = await getVideo("youtube");
        const second = await getVideo("youtube");

        // Assert
        expect(first.status).toBe(200);
        expect(await first.json()).toEqual(VIDEO_INFO);
        expect(await second.json()).toEqual(VIDEO_INFO);
        expect(getVideoInfo).toHaveBeenCalledExactlyOnceWith(VIDEO_ID);
        expect(serverManager.videoCache.get(`youtube:${VIDEO_ID}`)).toEqual(VIDEO_INFO);
    });

    it("answers 500 when the provider fails, and caches nothing so the next request retries", async () => {
        // Arrange
        getVideoInfo.mockRejectedValueOnce(new Error("quota exceeded"));

        // Act
        const failed = await getVideo("youtube");
        const retried = await getVideo("youtube");

        // Assert
        expect(failed.status).toBe(500);
        expect(await failed.json()).toEqual({ error: "Failed to fetch video data" });
        expect(retried.status).toBe(200);
        expect(getVideoInfo).toHaveBeenCalledTimes(2);
    });

    it("rejects an unsupported service with 400 without calling a provider", async () => {
        // Act
        const res = await getVideo("vimeo", "123456");

        // Assert
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Unsupported video service: vimeo" });
        expect(getVideoInfo).not.toHaveBeenCalled();
    });

    it("fetches from the provider again once the cached copy is an hour old", async () => {
        // Arrange
        vi.useFakeTimers({ toFake: ["setTimeout"] });
        await getVideo("youtube");

        // Act
        vi.advanceTimersByTime(ONE_HOUR - 1);
        await getVideo("youtube");
        const callsBeforeExpiry = getVideoInfo.mock.calls.length;
        vi.advanceTimersByTime(1);
        await getVideo("youtube");

        // Assert
        expect(callsBeforeExpiry).toBe(1);
        expect(getVideoInfo).toHaveBeenCalledTimes(2);
    });

    it.each(["toString", "constructor", "__proto__"])("rejects the inherited object key %s as an unsupported service", async (service) => {
        // Act
        const res = await getVideo(service);

        // Assert
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: `Unsupported video service: ${service}` });
    });
});


describe("GET /health", () => {
    it("answers 200 OK", async () => {
        // Act
        const res = await fetch(`${server.url}/health`);

        // Assert
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("OK");
    });
});


describe("GET /version", () => {
    it("serves the version from the backend's package.json", async () => {
        // Arrange
        const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

        // Act
        const res = await fetch(`${server.url}/version`);

        // Assert
        expect(await res.json()).toEqual({ version });
    });
});


describe("GET /v1/users/generate", () => {
    it("serves a new random user profile", async () => {
        // Act
        const res = await fetch(`${server.url}/v1/users/generate`);

        // Assert
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            id: expect.stringMatching(/^.+$/),
            username: expect.stringMatching(/^.+$/),
            icon: expect.stringMatching(/^https?:\/\//)
        });
    });
});
