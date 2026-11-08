import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import Message from "../../src/components/chat/Message";
import { chatMessage, OTHER_USER } from "../support/helpers";


const IN_ROOM = new Set([OTHER_USER.id]);


describe("Message", () => {
    it("shows a message under its sender's name and icon", () => {
        // Act
        render(<Message message={chatMessage({ text: "hi all" })} ref={null} showHeader={true} onlineUserIds={IN_ROOM} />);

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
        render(<Message message={chatMessage({ systemEvent, text: undefined })} ref={null} showHeader={true} onlineUserIds={IN_ROOM} />);

        // Assert: no sender header or icon
        expect(screen.getByText(line).getAttribute("title")).toBeTruthy();
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("rings the icon of an author who is in the room in green", () => {
        // Act
        render(<Message message={chatMessage()} ref={null} showHeader={true} onlineUserIds={IN_ROOM} />);

        // Assert
        const ring = screen.getByTitle("In the room");
        expect(ring.className).toContain("border-green-500");
        expect(ring.className).not.toContain("opacity-60");
        expect(ring.querySelector("img")?.getAttribute("src")).toBe(OTHER_USER.icon);
    });

    it("rings the icon of an author who is not in the room in dimmed gray", () => {
        // Act
        render(<Message message={chatMessage()} ref={null} showHeader={true} onlineUserIds={new Set()} />);

        // Assert
        const ring = screen.getByTitle("Not in the room");
        expect(ring.className).toContain("border-neutral-300");
        expect(ring.className).toContain("opacity-60");
        expect(ring.className).not.toContain("border-green-500");
    });

    it("matches the author by id, so a renamed author is still in the room", () => {
        // Act
        render(<Message message={chatMessage({ user: { ...OTHER_USER, username: "Old Name" } })} ref={null} showHeader={true} onlineUserIds={IN_ROOM} />);

        // Assert
        expect(screen.getByTitle("In the room")).toBeTruthy();
    });

    it("shows no ring on a grouped message, which has no icon", () => {
        // Act
        render(<Message message={chatMessage()} ref={null} showHeader={false} onlineUserIds={IN_ROOM} />);

        // Assert
        expect(screen.queryByTitle("In the room")).toBeNull();
        expect(screen.queryByTitle("Not in the room")).toBeNull();
    });
});
