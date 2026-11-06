import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import Message from "../../src/components/chat/Message";
import { chatMessage, OTHER_USER } from "../support/helpers";


describe("Message", () => {
    it("shows a message under its sender's name and icon", () => {
        // Act
        render(<Message message={chatMessage({ text: "hi all" })} ref={null} showHeader={true} />);

        // Assert
        expect(screen.getByText("hi all")).toBeTruthy();
        expect(screen.getByText(OTHER_USER.username)).toBeTruthy();
        expect(screen.getByRole("img").getAttribute("src")).toBe(OTHER_USER.icon);
    });

    it.each<{ systemEvent: NonNullable<ChatMessage["systemEvent"]>; line: string }>([
        { systemEvent: "joined", line: "OtherUser has joined the room." },
        { systemEvent: "left", line: "OtherUser has left the room." },
        { systemEvent: "disconnected", line: "OtherUser has disconnected from the room." }
    ])("shows a $systemEvent event as one line about its user, with the time on hover", ({ systemEvent, line }) => {
        // Act
        render(<Message message={chatMessage({ systemEvent, text: undefined })} ref={null} showHeader={true} />);

        // Assert: no sender header or icon
        expect(screen.getByText(line).getAttribute("title")).toBeTruthy();
        expect(screen.queryByRole("img")).toBeNull();
    });
});
