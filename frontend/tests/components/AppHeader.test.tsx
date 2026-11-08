import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AppHeader from "../../src/components/common/AppHeader";
import { SELF_USER } from "../support/helpers";


describe("AppHeader", () => {
    it("shows the children, then the actions, then the profile menu last", () => {
        // Act
        render(
            <AppHeader user={SELF_USER} onUpdateProfile={vi.fn()} actions={<button>An action</button>}>
                <p>A child</p>
            </AppHeader>
        );

        // Assert
        const child = screen.getByText("A child");
        const action = screen.getByText("An action");
        const menu = screen.getByTitle("Edit Profile");
        expect(child.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(action.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("has no profile menu until the user is known", () => {
        // Act
        render(<AppHeader onUpdateProfile={vi.fn()} />);

        // Assert
        expect(screen.queryByTitle("Edit Profile")).toBeNull();
    });

    it("passes a profile edit to onUpdateProfile", async () => {
        // Arrange
        const onUpdateProfile = vi.fn();
        const user = userEvent.setup();
        render(<AppHeader user={SELF_USER} onUpdateProfile={onUpdateProfile} />);

        // Act
        await user.click(screen.getByTitle("Edit Profile"));
        await user.clear(screen.getByRole("textbox", { name: "Name" }));
        await user.type(screen.getByRole("textbox", { name: "Name" }), "New Name");
        await user.click(screen.getByRole("button", { name: "Save" }));

        // Assert
        expect(onUpdateProfile).toHaveBeenCalledExactlyOnceWith({ username: "New Name" });
    });
});
