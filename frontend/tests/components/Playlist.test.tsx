import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Playlist from "../../src/components/playlist/Playlist";
import { playlistItem, VIDEO_A } from "../support/helpers";


/** The playlist header squares off its bottom corners only while the list below it is open and has rows */
function headerIsJoinedToList() {
    return screen.getByText("Playlist").parentElement!.classList.contains("rounded-b-none");
}


describe("Playlist", () => {
    it("joins its header to the list as soon as it has a video, and rounds it again once it is empty", () => {
        // Arrange
        const props = { currentIndex: 0, onVideoSelect: vi.fn(), fetchVideoInfo: async () => null };

        // Act
        const { rerender } = render(<Playlist videos={[playlistItem(VIDEO_A)]} {...props} />);

        // Assert
        expect(headerIsJoinedToList()).toBe(true);

        // Act
        rerender(<Playlist videos={[]} {...props} />);

        // Assert
        expect(headerIsJoinedToList()).toBe(false);

        // Act
        rerender(<Playlist videos={[playlistItem(VIDEO_A)]} {...props} />);

        // Assert
        expect(headerIsJoinedToList()).toBe(true);
    });
});
