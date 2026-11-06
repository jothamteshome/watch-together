import type { Page } from "@playwright/test";
import {
    chatButton,
    enterRoom,
    expect,
    playerOf,
    PlayerState,
    playlistMarkers,
    queueVideo,
    readChat,
    test,
    VIDEO_A,
    VIDEO_B,
    VIDEO_C,
    waitUntilJoined
} from "./fixtures";


/** Long enough for any follow-up round trip (a stray video:set or playlist:next) to land */
const SETTLE_MS = 1000;

/** Waits until every member's player has loaded `videoId` */
async function expectPlaying(members: Page[], videoId: string) {
    for (const member of members) {
        await expect.poll(() => playerOf(member)).toMatchObject({ videoId, state: PlayerState.PLAYING });
    }
}


test.describe("two members in a room", () => {
    test("a queued video appears in both playlists and plays for both", async ({ page, openUser, createRoom }) => {
        // Arrange
        const roomId = await createRoom();
        const guest = await openUser();
        await enterRoom(page, roomId);
        await enterRoom(guest, roomId);

        // Act
        await queueVideo(page, VIDEO_A);

        // Assert
        for (const member of [page, guest]) {
            await expect(member.getByTitle("Video A", { exact: true })).toBeVisible();
        }
        await expectPlaying([page, guest], "aaaaaaaaaaa");
    });

    test("a member joining mid-video starts where the room is, and nobody is reset to 0s", async ({ page, openUser, createRoom }) => {
        // Arrange: the host has been watching A for 3s. The guest opens a shared link in a fresh tab,
        // so the browser blocks autoplay; their player never reports PLAYING, which would otherwise
        // re-broadcast the right time and mask a reset
        const roomId = await createRoom();
        await enterRoom(page, roomId);
        await queueVideo(page, VIDEO_A);
        await expectPlaying([page], "aaaaaaaaaaa");
        await page.waitForTimeout(3000);
        const guest = await openUser();
        await guest.addInitScript(() => { window.__ytAutoplayBlocked = true; });

        // Act
        await enterRoom(guest, roomId);
        await expect.poll(() => playerOf(guest)).toMatchObject({ videoId: "aaaaaaaaaaa" });
        await page.waitForTimeout(SETTLE_MS);

        // Assert: neither member was reset to the start by the join
        const [host, joiner] = [(await playerOf(page))!, (await playerOf(guest))!];
        expect(joiner.loads[0].startSeconds).toBeGreaterThanOrEqual(2);
        expect(joiner.time).toBeGreaterThanOrEqual(2);
        expect(host.time).toBeGreaterThanOrEqual(2);
    });

    test("selecting a playlist row switches both members to that video", async ({ page, openUser, createRoom }) => {
        // Arrange
        const roomId = await createRoom();
        const guest = await openUser();
        await enterRoom(page, roomId);
        await enterRoom(guest, roomId);
        await queueVideo(page, VIDEO_A);
        await queueVideo(page, VIDEO_B);
        await expect(guest.getByTitle("Video B", { exact: true })).toBeVisible();

        // Act
        await guest.getByTitle("Video B", { exact: true }).click();

        // Assert
        await expectPlaying([page, guest], "bbbbbbbbbbb");
        for (const member of [page, guest]) {
            await expect.poll(() => playlistMarkers(member)).toEqual(["1", "▶"]);
        }
    });

    test("when one member's video ends, the playlist advances exactly one item for everyone", async ({ page, openUser, createRoom }) => {
        // Arrange
        const roomId = await createRoom();
        const guest = await openUser();
        await enterRoom(page, roomId);
        await enterRoom(guest, roomId);
        for (const video of [VIDEO_A, VIDEO_B, VIDEO_C]) await queueVideo(page, video);
        await expectPlaying([page, guest], "aaaaaaaaaaa");
        await expect.poll(() => playlistMarkers(guest)).toEqual(["▶", "2", "3"]);

        // Act
        await page.evaluate(() => window.__yt.end());

        // Assert
        await expectPlaying([page, guest], "bbbbbbbbbbb");
        await page.waitForTimeout(SETTLE_MS);
        for (const member of [page, guest]) {
            expect(await playlistMarkers(member)).toEqual(["1", "▶", "3"]);
        }
    });

    test("a pause by one member pauses the other", async ({ page, openUser, createRoom }) => {
        // Arrange
        const roomId = await createRoom();
        const guest = await openUser();
        await enterRoom(page, roomId);
        await enterRoom(guest, roomId);
        await queueVideo(page, VIDEO_A);
        await expectPlaying([page, guest], "aaaaaaaaaaa");

        // Act
        await page.evaluate(() => window.__yt.pause());

        // Assert
        await expect.poll(() => playerOf(guest)).toMatchObject({ state: PlayerState.PAUSED });
    });

    test("resuming by one member resumes the other", async ({ page, openUser, createRoom }) => {
        // Arrange
        const roomId = await createRoom();
        const guest = await openUser();
        await enterRoom(page, roomId);
        await enterRoom(guest, roomId);
        await queueVideo(page, VIDEO_A);
        await expectPlaying([page, guest], "aaaaaaaaaaa");
        await page.evaluate(() => window.__yt.pause());
        await expect.poll(() => playerOf(guest)).toMatchObject({ state: PlayerState.PAUSED });

        // Act
        await page.evaluate(() => window.__yt.play());

        // Assert
        await expect.poll(() => playerOf(guest)).toMatchObject({ state: PlayerState.PLAYING });
    });

    test("a chat message reaches the other member with an unread badge", async ({ page, openUser, createRoom }) => {
        // Arrange: the host has read everything so far, including the guest's join message
        const roomId = await createRoom();
        const guest = await openUser();
        await enterRoom(page, roomId);
        await enterRoom(guest, roomId);
        await readChat(page);

        // Act
        await chatButton(guest).click();
        await guest.getByPlaceholder("Type a message...").fill("hello from the guest");
        await guest.getByPlaceholder("Type a message...").press("Enter");

        // Assert
        await expect(chatButton(page)).toHaveText("1");
        await chatButton(page).click();
        await expect(page.getByText("hello from the guest")).toBeVisible();
    });

    test("BUG B1: when every member's video ends together, the playlist still advances exactly one item", async ({ page, openUser, createRoom }) => {
        test.fail();

        // Arrange
        const roomId = await createRoom();
        const guest = await openUser();
        await enterRoom(page, roomId);
        await enterRoom(guest, roomId);
        for (const video of [VIDEO_A, VIDEO_B, VIDEO_C]) await queueVideo(page, video);
        await expectPlaying([page, guest], "aaaaaaaaaaa");

        // Act: both players reach the end, as they do when members are in sync
        await Promise.all([page.evaluate(() => window.__yt.end()), guest.evaluate(() => window.__yt.end())]);

        // Assert
        await page.waitForTimeout(SETTLE_MS);
        for (const member of [page, guest]) {
            expect(await playlistMarkers(member)).toEqual(["1", "▶", "3"]);
        }
    });

    test("BUG B3: after going Back and joining another room, the first room's chat stays out", async ({ page, openUser, createRoom }) => {
        test.fail();

        // Arrange: the user visits room A, goes Back home and joins room B; a guest stays in A
        const [roomA, roomB] = [await createRoom(), await createRoom()];
        await page.goto("/");
        await page.getByPlaceholder("Enter Room ID").fill(roomA);
        await page.getByPlaceholder("Enter Room ID").press("Enter");
        await waitUntilJoined(page);
        await page.goBack();
        await page.getByPlaceholder("Enter Room ID").fill(roomB);
        await page.getByPlaceholder("Enter Room ID").press("Enter");
        await expect(page).toHaveURL(new RegExp(`/room/${roomB}$`));
        await waitUntilJoined(page);
        const guest = await openUser();
        await enterRoom(guest, roomA);

        // Act
        await chatButton(guest).click();
        await guest.getByPlaceholder("Type a message...").fill("message for room A");
        await guest.getByPlaceholder("Type a message...").press("Enter");
        await expect(guest.getByText("message for room A")).toBeVisible();

        // Assert
        await chatButton(page).click();
        await page.waitForTimeout(SETTLE_MS);
        await expect(page.getByText("message for room A")).toHaveCount(0);
    });
});
