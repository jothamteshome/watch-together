import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoState } from "@shared/interfaces/States";
import RoomPage from "../src/pages/RoomPage";
import { socket } from "./fakeSocket";
import { installYoutube, latestPlayer } from "./fakeYoutube";
import {
    chatMessage,
    playlistItem,
    playlistState,
    ROOM_ID,
    seedProfile,
    SELF_USER,
    stubFetch,
    UNSUPPORTED_URL,
    VIDEO_A,
    VIDEO_B,
    videoInfo,
    videoState,
    type Route as FetchRoute
} from "./helpers";

vi.mock("../src/services/socket", () => import("./fakeSocket"));


const VIDEO_API = "/v1/video-api/youtube/video";

function stubBackend(overrides: Record<string, FetchRoute> = {}) {
    return stubFetch({
        [`/v1/rooms/${ROOM_ID}`]: { body: videoState({ videoUrl: null }) },
        "/health": { body: "OK" },
        "/version": { body: { version: "2.0.0" } },
        [`${VIDEO_API}/aaaaaaaaaaa`]: { body: videoInfo("Video A") },
        [`${VIDEO_API}/bbbbbbbbbbb`]: { body: videoInfo("Video B") },
        ...overrides
    });
}


function renderRoomPage() {
    render(
        <MemoryRouter initialEntries={[`/room/${ROOM_ID}`]}>
            <Routes>
                <Route path="/room/:roomId" element={<RoomPage />} />
            </Routes>
        </MemoryRouter>
    );
}


/**
 * Renders the room page and waits until it has joined: the room has been found and the stored
 * profile resolved, so the page knows which messages are its own
 */
async function renderRoom() {
    renderRoomPage();
    await screen.findByPlaceholderText("Enter a url...");
    await waitFor(() => expect(socket.emitted("room:join")).toEqual([{ roomId: ROOM_ID, user: SELF_USER }]));
}


/** Delivers a server event inside act() so React applies the resulting updates */
async function deliver(event: string, payload: unknown) {
    await act(async () => {
        await socket.receive(event, payload);
    });
}


/** Delivers the room's first video:sync and fires the player's onReady, as the iframe API would */
async function deliverFirstVideo(state: VideoState) {
    await act(async () => {
        const synced = socket.receive("video:sync", state);
        latestPlayer().ready();
        await synced;
    });
}


function chatButton() {
    return screen.getByTitle("Open Chat");
}


/** A playlist row, found through the title its heading shows */
function playlistRow(title: string) {
    return screen.getByTitle(title).parentElement!.parentElement!;
}


beforeEach(() => {
    // Fake intervals that still advance in real time: RTL's polling keeps working, and
    // afterEach's clearAllTimers drops the intervals the app never clears (playback-rate monitor)
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"], shouldAdvanceTime: true });
    installYoutube();
    seedProfile();
    socket.connected = true;
});


describe("unread chat badge", () => {
    it("counts messages from other members while the chat is closed", async () => {
        // Arrange
        stubBackend();
        await renderRoom();

        // Act
        await deliver("chat:sync", chatMessage());
        await deliver("chat:sync", chatMessage());

        // Assert
        expect(chatButton().textContent).toBe("2");
    });

    it("ignores this client's own messages echoed back by the server", async () => {
        // Arrange
        stubBackend();
        await renderRoom();

        // Act
        await deliver("chat:sync", chatMessage({ user: SELF_USER }));

        // Assert
        expect(chatButton().textContent).toBe("");
    });

    it("doesn't count messages that arrive while the chat is open", async () => {
        // Arrange
        stubBackend();
        await renderRoom();
        const user = userEvent.setup();
        await user.click(chatButton());

        // Act
        await deliver("chat:sync", chatMessage({ text: "seen live" }));
        await user.click(chatButton());

        // Assert
        expect(chatButton().textContent).toBe("");
    });

    it("clears the count when the chat is opened, and counts again once it's closed", async () => {
        // Arrange
        stubBackend();
        await renderRoom();
        const user = userEvent.setup();
        await deliver("chat:sync", chatMessage());

        // Act
        await user.click(chatButton());
        const countWhileOpen = chatButton().textContent;
        await user.click(chatButton());
        await deliver("chat:sync", chatMessage());

        // Assert
        expect(countWhileOpen).toBe("");
        expect(chatButton().textContent).toBe("1");
    });
});


describe("playlist", () => {
    it("lists the videos in order by title and marks the current one", async () => {
        // Arrange
        stubBackend();
        await renderRoom();

        // Act
        await deliver("playlist:sync", playlistState({ eventId: 1, items: [playlistItem(VIDEO_A), playlistItem(VIDEO_B)], currentIndex: 1 }));
        await screen.findByTitle("Video A");
        await screen.findByTitle("Video B");

        // Assert: non-current rows show their position, the current row shows a play icon instead
        expect(screen.getAllByTitle(/^Video [AB]$/).map(title => title.textContent)).toEqual(["Video A", "Video B"]);
        expect(within(playlistRow("Video A")).getByText("1")).toBeTruthy();
        expect(within(playlistRow("Video B")).queryByText("2")).toBeNull();
    });

    it("keeps the last video marked once the playlist has ended", async () => {
        // Arrange
        stubBackend();
        await renderRoom();

        // Act
        await deliver("playlist:sync", playlistState({ eventId: 1, items: [playlistItem(VIDEO_A), playlistItem(VIDEO_B)], currentIndex: -1 }));
        await screen.findByTitle("Video B");

        // Assert
        expect(within(playlistRow("Video B")).queryByText("2")).toBeNull();
        expect(within(playlistRow("Video A")).getByText("1")).toBeTruthy();
    });

    it("asks the server to play a video when its row is clicked", async () => {
        // Arrange
        stubBackend();
        await renderRoom();
        const user = userEvent.setup();
        await deliver("playlist:sync", playlistState({ eventId: 1, items: [playlistItem(VIDEO_A), playlistItem(VIDEO_B)], currentIndex: 0 }));

        await screen.findByTitle("Video B");

        // Act
        await user.click(playlistRow("Video B"));

        // Assert
        expect(socket.emitted("playlist:select")).toEqual([{ roomId: ROOM_ID, index: 1 }]);
    });
});


describe("search bar", () => {
    it("queues the entered URL on Enter and on the search button", async () => {
        // Arrange
        stubBackend();
        await renderRoom();
        const user = userEvent.setup();
        const input = screen.getByPlaceholderText("Enter a url...");

        // Act
        await user.type(input, `${VIDEO_A}{Enter}`);
        await user.type(input, VIDEO_B);
        await user.click(input.nextElementSibling as HTMLElement);

        // Assert
        expect(socket.emitted("playlist:add")).toEqual([
            { roomId: ROOM_ID, videoUrl: VIDEO_A, videoService: "youtube" },
            { roomId: ROOM_ID, videoUrl: VIDEO_B, videoService: "youtube" }
        ]);
    });

    it("alerts instead of queueing an unsupported URL", async () => {
        // Arrange
        stubBackend();
        await renderRoom();
        const user = userEvent.setup();
        const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

        // Act
        await user.type(screen.getByPlaceholderText("Enter a url..."), `${UNSUPPORTED_URL}{Enter}`);

        // Assert
        expect(socket.emitted("playlist:add")).toEqual([]);
        expect(alertSpy).toHaveBeenCalledExactlyOnceWith(`Unsupported video URL: ${UNSUPPORTED_URL}`);
    });
});


describe("chat input", () => {
    it("sends the trimmed message on Enter", async () => {
        // Arrange
        stubBackend();
        await renderRoom();
        const user = userEvent.setup();
        await user.click(chatButton());

        // Act
        await user.type(screen.getByPlaceholderText("Type a message..."), "  hello room  {Enter}");

        // Assert
        expect(socket.emitted("chat:message")).toEqual([{ roomId: ROOM_ID, msg: "hello room" }]);
    });

    it("sends nothing for Shift+Enter or a blank message", async () => {
        // Arrange
        stubBackend();
        await renderRoom();
        const user = userEvent.setup();
        await user.click(chatButton());
        const textarea = screen.getByPlaceholderText("Type a message...");

        // Act
        await user.type(textarea, "line one{Shift>}{Enter}{/Shift}");
        await user.clear(textarea);
        await user.type(textarea, "   {Enter}");

        // Assert
        expect(socket.emitted("chat:message")).toEqual([]);
    });
});


describe("video", () => {
    it("shows the player and the video's metadata once a video is loaded", async () => {
        // Arrange
        stubBackend();
        await renderRoom();
        const placeholderBefore = screen.queryByText("No video playing");

        // Act
        await deliverFirstVideo(videoState({ videoUrl: VIDEO_A }));

        // Assert
        expect(await screen.findByText("Video A")).toBeTruthy();
        expect(placeholderBefore).not.toBeNull();
        expect(screen.queryByText("No video playing")).toBeNull();
    });

    it.fails("BUG B4: shows the player even when the video's metadata can't be fetched", async () => {
        // Arrange
        stubBackend({ [`${VIDEO_API}/aaaaaaaaaaa`]: { status: 500 } });
        await renderRoom();

        // Act
        await deliverFirstVideo(videoState({ videoUrl: VIDEO_A }));

        // Assert
        await waitFor(() => expect(screen.queryByText("No video playing")).toBeNull());
    });
});


describe("missing room", () => {
    it.each([
        { case: "doesn't exist", route: { status: 404 } },
        { case: "can't be checked", route: new Error("network down") }
    ])("shows Room Not Found and never joins when the room $case", async ({ route }) => {
        // Arrange
        stubBackend({ [`/v1/rooms/${ROOM_ID}`]: route });

        // Act
        renderRoomPage();

        // Assert
        expect(await screen.findByText("Room Not Found")).toBeTruthy();
        expect(socket.connect).not.toHaveBeenCalled();
        expect(socket.emitted("room:join")).toEqual([]);
    });
});
