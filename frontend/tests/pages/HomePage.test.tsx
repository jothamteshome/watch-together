import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import HomePage from "../../src/pages/HomePage";
import { GENERATED_ICON_PREFIX } from "../../src/utils/identity";
import { OTHER_USER, SELF_USER, seedProfile, stubFetch } from "../support/helpers";


const PROFILE_KEY = "watch-together:profile";

function renderHome() {
    render(
        <MemoryRouter>
            <HomePage />
        </MemoryRouter>
    );
}

function storedProfile() {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)!);
}


describe("HomePage", () => {
    it("offers to create or join a room", () => {
        // Arrange
        seedProfile();

        // Act
        renderHome();

        // Assert
        expect(screen.getByRole("button", { name: "Create Room" })).toBeTruthy();
        expect(screen.getByPlaceholderText("Enter Room ID")).toBeTruthy();
    });

    it("shows the stored profile in the header menu", async () => {
        // Arrange
        seedProfile();

        // Act
        renderHome();
        await userEvent.click(await screen.findByTitle("Edit Profile"));

        // Assert
        expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe(SELF_USER.username);
    });

    it("generates and stores a profile on a first visit", async () => {
        // Arrange
        stubFetch({ "/v1/users/generate": { body: OTHER_USER } });

        // Act
        renderHome();
        await userEvent.click(await screen.findByTitle("Edit Profile"));

        // Assert
        expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe(OTHER_USER.username);
        expect(storedProfile()).toEqual(OTHER_USER);
    });

    it("still offers the room controls when no profile can be generated", async () => {
        // Arrange
        stubFetch({ "/v1/users/generate": new Error("offline") });

        // Act
        renderHome();

        // Assert
        expect(await screen.findByRole("button", { name: "Create Room" })).toBeTruthy();
        expect(screen.queryByTitle("Edit Profile")).toBeNull();
    });

    it("keeps a rename for the next visit", async () => {
        // Arrange
        seedProfile();
        const user = userEvent.setup();
        renderHome();
        await user.click(await screen.findByTitle("Edit Profile"));

        // Act
        await user.clear(screen.getByRole("textbox", { name: "Name" }));
        await user.type(screen.getByRole("textbox", { name: "Name" }), "New Name");
        await user.click(screen.getByRole("button", { name: "Save" }));

        // Assert
        expect(storedProfile()).toEqual({ ...SELF_USER, username: "New Name" });
        await user.click(screen.getByTitle("Edit Profile"));
        expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe("New Name");
    });

    it("moves a generated icon to the new name", async () => {
        // Arrange
        seedProfile({ ...SELF_USER, icon: `${GENERATED_ICON_PREFIX}${SELF_USER.username}` });
        const user = userEvent.setup();
        renderHome();
        await user.click(await screen.findByTitle("Edit Profile"));

        // Act
        await user.clear(screen.getByRole("textbox", { name: "Name" }));
        await user.type(screen.getByRole("textbox", { name: "Name" }), "New Name");
        await user.click(screen.getByRole("button", { name: "Save" }));

        // Assert
        expect(storedProfile().icon).toBe(`${GENERATED_ICON_PREFIX}New%20Name`);
        expect(screen.getByRole("img").getAttribute("src")).toBe(`${GENERATED_ICON_PREFIX}New%20Name`);
    });
});
