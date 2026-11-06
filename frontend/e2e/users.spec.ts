import type { Page } from "@playwright/test";
import { chatButton, enterRoom, expect, queueVideo, test, VIDEO_A, VIDEO_B } from "./fixtures";


/** The username this page's browser generated and stored on its first join */
function usernameOf(page: Page): Promise<string> {
    return page.evaluate(() => JSON.parse(localStorage.getItem("watch-together:profile")!).username);
}

/** Renames this page's user through the profile menu */
async function rename(page: Page, username: string) {
    await page.getByTitle("Edit Profile").click();
    await page.getByRole("textbox", { name: "Name" }).fill(username);
    await page.getByRole("button", { name: "Save" }).click();
}

async function sendChat(page: Page, msg: string) {
    await chatButton(page).click();
    await page.getByPlaceholder("Type a message...").fill(msg);
    await page.getByPlaceholder("Type a message...").press("Enter");
    await expect(page.getByText(msg)).toBeVisible();
    await chatButton(page).click();
}

function onlineUsers(page: Page) {
    return page.getByTitle("Online Users");
}


test.describe("user profiles", () => {
    test("each playlist row credits who added it, under the name they had then", async ({ page, openUser, createRoom }) => {
        // Arrange
        const roomId = await createRoom();
        const guest = await openUser();
        await enterRoom(page, roomId);
        await enterRoom(guest, roomId);
        const guestName = await usernameOf(guest);
        await queueVideo(guest, VIDEO_A);
        await expect(page.getByTitle(`Added by ${guestName}`)).toBeVisible();

        // Act
        await rename(guest, "Renamed Guest");
        await queueVideo(guest, VIDEO_B);

        // Assert
        await expect(page.getByTitle("Added by Renamed Guest")).toHaveCount(1);
        await expect(page.getByTitle(`Added by ${guestName}`)).toHaveCount(1);
    });

    test("a rename reaches the other member's user list and new messages, while older messages keep the old name", async ({ page, openUser, createRoom }) => {
        // Arrange
        const roomId = await createRoom();
        const guest = await openUser();
        await enterRoom(page, roomId);
        await enterRoom(guest, roomId);
        const guestName = await usernameOf(guest);
        await sendChat(guest, "before rename");

        // Act
        await rename(guest, "Renamed Guest");
        await sendChat(guest, "after rename");

        // Assert: each message sits under the name it was sent with
        await onlineUsers(page).click();
        await expect(page.getByRole("listitem").filter({ hasText: "Renamed Guest" })).toBeVisible();
        await onlineUsers(page).click();
        await chatButton(page).click();
        const chat = page.getByPlaceholder("Type a message...").locator("xpath=../..");
        await expect(chat.getByText(guestName, { exact: true })).toBeVisible();
        await expect(chat.getByText("Renamed Guest", { exact: true })).toBeVisible();
    });

    test("the user count follows members joining and leaving, and counts a user's two tabs once", async ({ page, openUser, createRoom }) => {
        // Arrange
        const roomId = await createRoom();
        await enterRoom(page, roomId);
        await expect(onlineUsers(page)).toHaveText("1");

        // Act + Assert: a second tab of the same browser is the same user
        const secondTab = await page.context().newPage();
        await enterRoom(secondTab, roomId);
        await expect(onlineUsers(page)).toHaveText("1");

        const guest = await openUser();
        await enterRoom(guest, roomId);
        await expect(onlineUsers(page)).toHaveText("2");

        await guest.close();
        await expect(onlineUsers(page)).toHaveText("1");
    });
});
