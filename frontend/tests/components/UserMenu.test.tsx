import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import UserMenu from "../../src/components/user/UserMenu";
import { GENERATED_ICON_PREFIX } from "../../src/utils/identity";
import { SELF_USER } from "../support/helpers";


function renderMenu(profile = SELF_USER) {
    const onUpdate = vi.fn();
    render(<UserMenu user={profile} onUpdate={onUpdate} />);
    return { onUpdate, user: userEvent.setup() };
}

function menuButton() {
    return screen.getByTitle("Edit Profile");
}

function nameInput() {
    return screen.getByRole<HTMLInputElement>("textbox", { name: "Name" });
}

function saveButton() {
    return screen.getByRole("button", { name: "Save" });
}


describe("UserMenu", () => {
    it("sends the trimmed new name and closes", async () => {
        // Arrange
        const { onUpdate, user } = renderMenu();
        await user.click(menuButton());

        // Act
        await user.clear(nameInput());
        await user.type(nameInput(), "  New Name  ");
        await user.click(saveButton());

        // Assert
        expect(onUpdate).toHaveBeenCalledExactlyOnceWith({ username: "New Name" });
        expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    });

    it("sends a new generated icon along with the name when the current icon is generated", async () => {
        // Arrange
        const { onUpdate, user } = renderMenu({ ...SELF_USER, icon: `${GENERATED_ICON_PREFIX}${SELF_USER.username}` });
        await user.click(menuButton());

        // Act
        await user.clear(nameInput());
        await user.type(nameInput(), "New Name");
        await user.click(saveButton());

        // Assert
        expect(onUpdate).toHaveBeenCalledExactlyOnceWith({ username: "New Name", icon: `${GENERATED_ICON_PREFIX}New%20Name` });
    });

    it.each([
        { case: "unchanged", draft: SELF_USER.username },
        { case: "the current name with padding", draft: `  ${SELF_USER.username} ` },
        { case: "blank", draft: "   " }
    ])("won't save a name that is $case", async ({ draft }) => {
        // Arrange
        const { onUpdate, user } = renderMenu();
        await user.click(menuButton());

        // Act: Enter submits the form even with the button disabled
        await user.clear(nameInput());
        await user.type(nameInput(), `${draft}{Enter}`);

        // Assert
        expect(saveButton()).toHaveProperty("disabled", true);
        expect(onUpdate).not.toHaveBeenCalled();
    });

    it("caps the name at the 40 characters the server accepts", async () => {
        // Arrange
        const { user } = renderMenu();
        await user.click(menuButton());

        // Act
        await user.clear(nameInput());
        await user.type(nameInput(), "x".repeat(45));

        // Assert
        expect(nameInput().value).toBe("x".repeat(40));
    });

    it("discards an unsaved draft when it's closed and reopened", async () => {
        // Arrange
        const { user } = renderMenu();
        await user.click(menuButton());
        await user.type(nameInput(), " draft");

        // Act
        await user.click(menuButton());
        await user.click(menuButton());

        // Assert
        expect(nameInput().value).toBe(SELF_USER.username);
    });

    it("closes on a click outside it", async () => {
        // Arrange
        const { user } = renderMenu();
        await user.click(menuButton());

        // Act
        await user.click(document.body);

        // Assert
        expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    });
});
