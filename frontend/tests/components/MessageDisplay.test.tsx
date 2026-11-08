import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type User from "@shared/interfaces/User";
import MessageDisplay from "../../src/components/chat/MessageDisplay";
import { chatMessage } from "../support/helpers";


const T0 = Date.UTC(2026, 0, 1);
const MINUTE = 60 * 1000;
const ALICE: User = { id: "alice", username: "Alice", icon: "https://example.test/alice.png" };
const BOB: User = { id: "bob", username: "Bob", icon: "https://example.test/bob.png" };

/** True when the message's content column holds an author/time header above its text */
function hasHeader(text: string): boolean {
    return screen.getByText(text).parentElement!.childElementCount === 2;
}


describe("message grouping", () => {
    it("collapses a message from the same author within 5 minutes under the previous header", () => {
        // Arrange
        const messages = [
            chatMessage({ user: ALICE, text: "first", timestamp: T0 }),
            chatMessage({ user: ALICE, text: "second", timestamp: T0 + MINUTE })
        ];

        // Act
        render(<MessageDisplay messages={messages} onlineUserIds={new Set()} />);

        // Assert
        expect(hasHeader("first")).toBe(true);
        expect(hasHeader("second")).toBe(false);
    });

    it.each<{ case: string; first: Partial<ChatMessage>; second: Partial<ChatMessage> }>([
        { case: "the author changes", first: { user: ALICE }, second: { user: BOB } },
        { case: "the author renames themselves", first: { user: ALICE }, second: { user: { ...ALICE, username: "Alicia" } } },
        { case: "the author changes their icon", first: { user: ALICE }, second: { user: { ...ALICE, icon: "https://example.test/new.png" } } },
        { case: "more than 5 minutes pass", first: { user: ALICE }, second: { user: ALICE, timestamp: T0 + 6 * MINUTE } },
        { case: "the previous message is a system message", first: { user: ALICE, systemEvent: "joined" }, second: { user: ALICE } }
    ])("starts a new header when $case", ({ first, second }) => {
        // Arrange
        const messages = [
            chatMessage({ text: "first", timestamp: T0, ...first }),
            chatMessage({ text: "second", timestamp: T0 + MINUTE, ...second })
        ];

        // Act
        render(<MessageDisplay messages={messages} onlineUserIds={new Set()} />);

        // Assert
        expect(hasHeader("second")).toBe(true);
    });
});


describe("presence rings", () => {
    it("passes the online ids to each message, so only the authors in the room get a green ring", () => {
        // Arrange
        const messages = [
            chatMessage({ user: ALICE, text: "from alice", timestamp: T0 }),
            chatMessage({ user: BOB, text: "from bob", timestamp: T0 + MINUTE })
        ];

        // Act
        render(<MessageDisplay messages={messages} onlineUserIds={new Set([ALICE.id])} />);

        // Assert
        expect(screen.getAllByTitle("In the room")).toHaveLength(1);
        expect(screen.getByTitle("In the room").querySelector("img")?.getAttribute("src")).toBe(ALICE.icon);
        expect(screen.getAllByTitle("Not in the room")).toHaveLength(1);
    });
});
