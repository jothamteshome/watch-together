import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import OnlineUsersButton from "../../src/components/user/OnlineUsersButton";
import { OTHER_USER, SELF_USER } from "../support/helpers";


function usersButton() {
    return screen.getByTitle("Online Users");
}


describe("OnlineUsersButton", () => {
    it("shows no count until the room's users are known, then counts them", () => {
        // Arrange
        const { rerender } = render(<OnlineUsersButton users={[]} selfUserId={SELF_USER.id} />);
        const countBefore = usersButton().textContent;

        // Act
        rerender(<OnlineUsersButton users={[SELF_USER, OTHER_USER]} selfUserId={SELF_USER.id} />);

        // Assert
        expect(countBefore).toBe("");
        expect(usersButton().textContent).toBe("2");
    });

    it("lists the users when opened and marks this user", async () => {
        // Arrange
        render(<OnlineUsersButton users={[SELF_USER, OTHER_USER]} selfUserId={SELF_USER.id} />);

        // Act
        await userEvent.click(usersButton());

        // Assert
        expect(screen.getByText(/^SelfUser/).textContent).toBe("SelfUser (you)");
        expect(screen.getByText(/^OtherUser/).textContent).toBe("OtherUser");
    });

    it("closes on a click outside it", async () => {
        // Arrange
        const user = userEvent.setup();
        render(<OnlineUsersButton users={[SELF_USER, OTHER_USER]} selfUserId={SELF_USER.id} />);
        await user.click(usersButton());

        // Act
        await user.click(document.body);

        // Assert
        expect(screen.queryByText(/^OtherUser/)).toBeNull();
    });
});
