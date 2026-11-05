import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import MessageDisplay from "../src/components/chat/MessageDisplay";
import { chatMessage } from "./helpers";


const T0 = Date.UTC(2026, 0, 1);
const MINUTE = 60 * 1000;

/** True when the message's content column holds an author/time header above its text */
function hasHeader(text: string): boolean {
    return screen.getByText(text).parentElement!.childElementCount === 2;
}


describe("message grouping", () => {
    it("collapses a message from the same author within 5 minutes under the previous header", () => {
        // Arrange
        const messages = [
            chatMessage({ author: "Alice", text: "first", timestamp: T0 }),
            chatMessage({ author: "Alice", text: "second", timestamp: T0 + MINUTE })
        ];

        // Act
        render(<MessageDisplay messages={messages} />);

        // Assert
        expect(hasHeader("first")).toBe(true);
        expect(hasHeader("second")).toBe(false);
    });

    it.each<{ case: string; first: Partial<ChatMessage>; second: Partial<ChatMessage> }>([
        { case: "the author changes", first: { author: "Alice" }, second: { author: "Bob" } },
        { case: "more than 5 minutes pass", first: { author: "Alice" }, second: { author: "Alice", timestamp: T0 + 6 * MINUTE } },
        { case: "the message is a system message", first: { author: "[SYSTEM]" }, second: { author: "[SYSTEM]", isSystemMessage: true } },
        { case: "the previous message is a system message", first: { author: "Alice", isSystemMessage: true }, second: { author: "Alice" } }
    ])("starts a new header when $case", ({ first, second }) => {
        // Arrange
        const messages = [
            chatMessage({ text: "first", timestamp: T0, ...first }),
            chatMessage({ text: "second", timestamp: T0 + MINUTE, ...second })
        ];

        // Act
        render(<MessageDisplay messages={messages} />);

        // Assert
        expect(hasHeader("second")).toBe(true);
    });
});
