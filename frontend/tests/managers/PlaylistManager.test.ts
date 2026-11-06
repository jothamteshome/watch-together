import { describe, expect, it, vi } from "vitest";
import PlaylistManager from "../../src/managers/PlaylistManager";
import { playlistItem, playlistState, VIDEO_A, VIDEO_B, VIDEO_C } from "../support/helpers";


const ITEM_A = playlistItem(VIDEO_A);
const ITEM_B = playlistItem(VIDEO_B);
const ITEM_C = playlistItem(VIDEO_C);

function createManager() {
    const updatePlaylistUI = vi.fn();
    const manager = new PlaylistManager(updatePlaylistUI);
    return { manager, updatePlaylistUI };
}


describe("eventId guard", () => {
    it("drops a sync whose eventId equals the last one applied", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();
        manager.sync(playlistState({ eventId: 3, items: [ITEM_A, ITEM_B], currentIndex: 1 }));
        updatePlaylistUI.mockClear();

        // Act
        manager.sync(playlistState({ eventId: 3, items: [ITEM_C], currentIndex: 0 }));

        // Assert
        expect(updatePlaylistUI).not.toHaveBeenCalled();
    });

    it("drops a sync older than the last one applied", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();
        manager.sync(playlistState({ eventId: 5, items: [ITEM_A, ITEM_B], currentIndex: 1 }));
        updatePlaylistUI.mockClear();

        // Act
        manager.sync(playlistState({ eventId: 4, items: [ITEM_A], currentIndex: 0 }));

        // Assert
        expect(updatePlaylistUI).not.toHaveBeenCalled();
    });

    it("drops the empty playlist of a room nobody has queued in yet", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();

        // Act: a fresh room's state, as a join snapshot carries it
        manager.sync(playlistState({ eventId: 0, items: [], currentIndex: -1 }));

        // Assert
        expect(updatePlaylistUI).not.toHaveBeenCalled();
    });
});


describe("sync", () => {
    it("sends the items and current index of a newer sync to the UI", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();

        // Act
        manager.sync(playlistState({ eventId: 1, items: [ITEM_A, ITEM_B], currentIndex: 1 }));

        // Assert
        expect(updatePlaylistUI).toHaveBeenCalledExactlyOnceWith([ITEM_A, ITEM_B], 1);
    });

    it("keeps the last video selected in the UI once the playlist has ended", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();

        // Act
        manager.sync(playlistState({ eventId: 1, items: [ITEM_A, ITEM_B], currentIndex: -1 }));

        // Assert
        expect(updatePlaylistUI).toHaveBeenCalledExactlyOnceWith([ITEM_A, ITEM_B], 1);
    });

    it("shows no selection for an empty playlist", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();

        // Act
        manager.sync(playlistState({ eventId: 1, items: [], currentIndex: -1 }));

        // Assert
        expect(updatePlaylistUI).toHaveBeenCalledExactlyOnceWith([], -1);
    });

    it("hands the UI its own copy of the items, not the array the server sent", () => {
        // Arrange
        const { manager, updatePlaylistUI } = createManager();
        const state = playlistState({ eventId: 1, items: [ITEM_A, ITEM_B], currentIndex: 0 });

        // Act
        manager.sync(state);

        // Assert
        const [uiItems] = updatePlaylistUI.mock.calls[0]!;
        expect(uiItems).toEqual(state.items);
        expect(uiItems).not.toBe(state.items);
    });
});
