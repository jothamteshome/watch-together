import { describe, expect, it, vi } from "vitest";
import PlaylistManager from "../src/managers/PlaylistManager";
import { playlistState, VIDEO_A, VIDEO_B, VIDEO_C } from "./helpers";


function createManager() {
    const updatePlaylistUI = vi.fn();
    const manager = new PlaylistManager(updatePlaylistUI);
    return { manager, updatePlaylistUI };
}


describe("eventId guard", () => {
    it("drops a sync whose eventId equals the last one applied", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();
        manager.sync(playlistState({ eventId: 3, items: [VIDEO_A, VIDEO_B], currentIndex: 1 }));
        updatePlaylistUI.mockClear();

        // Act
        manager.sync(playlistState({ eventId: 3, items: [VIDEO_C], currentIndex: 0 }));

        // Assert
        expect(updatePlaylistUI).not.toHaveBeenCalled();
        expect(manager.currentItem).toBe(VIDEO_B);
    });

    it("drops a sync older than the last one applied", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();
        manager.sync(playlistState({ eventId: 5, items: [VIDEO_A, VIDEO_B], currentIndex: 1 }));
        updatePlaylistUI.mockClear();

        // Act
        manager.sync(playlistState({ eventId: 4, items: [VIDEO_A], currentIndex: 0 }));

        // Assert
        expect(updatePlaylistUI).not.toHaveBeenCalled();
        expect(manager.currentIndex).toBe(1);
        expect(manager.length).toBe(2);
    });
});


describe("sync", () => {
    it("sends the items and current index of a newer sync to the UI", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();

        // Act
        manager.sync(playlistState({ eventId: 1, items: [VIDEO_A, VIDEO_B], currentIndex: 1 }));

        // Assert
        expect(updatePlaylistUI).toHaveBeenCalledExactlyOnceWith([VIDEO_A, VIDEO_B], 1);
    });

    it("keeps the last video selected in the UI once the playlist has ended", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();

        // Act
        manager.sync(playlistState({ eventId: 1, items: [VIDEO_A, VIDEO_B], currentIndex: -1 }));

        // Assert: the UI shows the last item, while the manager itself reports the ended state
        expect(updatePlaylistUI).toHaveBeenCalledExactlyOnceWith([VIDEO_A, VIDEO_B], 1);
        expect(manager.currentIndex).toBe(-1);
    });

    it("shows no selection for an empty playlist", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();

        // Act
        manager.sync(playlistState({ eventId: 1, items: [], currentIndex: -1 }));

        // Assert
        expect(updatePlaylistUI).toHaveBeenCalledExactlyOnceWith([], -1);
    });

    it("exposes the synced state and hands the UI a copy it can't mutate", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();
        manager.sync(playlistState({ eventId: 1, items: [VIDEO_A, VIDEO_B], currentIndex: 0 }));
        const [uiItems] = updatePlaylistUI.mock.calls[0];

        // Act
        uiItems.push(VIDEO_C);

        // Assert
        expect(manager.length).toBe(2);
        expect(manager.currentIndex).toBe(0);
        expect(manager.currentItem).toBe(VIDEO_A);
    });
});
