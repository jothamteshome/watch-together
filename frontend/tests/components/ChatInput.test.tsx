import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ChatInput from "../../src/components/chat/ChatInput";


describe("ChatInput", () => {
    it("stops the text at the server's 1000 character limit", async () => {
        // Arrange
        render(<ChatInput onSend={vi.fn()} />);
        const textarea = screen.getByPlaceholderText("Type a message...") as HTMLTextAreaElement;

        // Act
        await userEvent.setup().click(textarea);
        await userEvent.paste("x".repeat(1200));

        // Assert
        expect(textarea.maxLength).toBe(1000);
        expect(textarea.value).toHaveLength(1000);
    });
});
