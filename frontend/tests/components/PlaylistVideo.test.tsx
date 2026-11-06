import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PlaylistVideo from "../../src/components/playlist/PlaylistVideo";
import PlaylistVideoList from "../../src/components/playlist/PlaylistVideoList";
import { OTHER_USER, playlistItem, VIDEO_A, videoInfo } from "../support/helpers";


describe("PlaylistVideo", () => {
    it("credits the user who added it with their icon, and their name on hover", () => {
        // Act
        render(
            <PlaylistVideo
                item={playlistItem(VIDEO_A, { addedBy: OTHER_USER })}
                watching={false}
                index={0}
                ref={null}
                onVideoSelect={vi.fn()}
                fetchVideoInfo={async () => null}
            />
        );

        // Assert
        const credit = screen.getByTitle(`Added by ${OTHER_USER.username}`);
        expect(credit.querySelector("img")?.getAttribute("src")).toBe(OTHER_USER.icon);
    });
});


describe("PlaylistVideoList", () => {
    it("shows a URL queued twice as two rows, without a key clash", async () => {
        // Arrange
        const consoleError = vi.spyOn(console, "error");
        const copies = [playlistItem(VIDEO_A, { id: "item-a1" }), playlistItem(VIDEO_A, { id: "item-a2" })];

        // Act
        render(<PlaylistVideoList videos={copies} currentIndex={1} onVideoSelect={vi.fn()} fetchVideoInfo={async () => videoInfo("Video A")} />);

        // Assert
        expect(await screen.findAllByTitle("Video A")).toHaveLength(2);
        expect(consoleError).not.toHaveBeenCalled();
    });
});
