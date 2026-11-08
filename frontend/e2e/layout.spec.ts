import type { Page } from "@playwright/test";
import {
    boxOf,
    chatButton,
    enterRoom,
    expect,
    LONG_VIDEOS,
    playerOf,
    test,
    VIDEO_A,
    VIDEO_WITHOUT_METADATA
} from "./fixtures";


/** Tailwind max-h-100 / lg:max-h-200 on the playlist */
const PLAYLIST_MAX_HEIGHT = { mobile: 400, desktop: 800 };

const player = (page: Page) => page.locator("#youtube-player");
const playlistPanel = (page: Page) => page.getByRole("heading", { name: "Playlist", exact: true }).locator("xpath=../..");
const playlistScroller = (page: Page) => page.locator("h1[title]").first().locator("xpath=../../..");
const playlistRows = (page: Page) => page.locator("h1[title]");
const metadata = (page: Page) => page.getByRole("link", { name: /Channel aaaaaaaaaaa/ });
const chatPanel = (page: Page) => page.getByPlaceholder("Type a message...").locator("xpath=../..");


test.describe("room layout", () => {
    test("desktop: the playlist sits beside the player, top-aligned", async ({ page, createRoom, seeder, isMobile }) => {
        test.skip(isMobile, "desktop layout");

        // Arrange
        const roomId = await createRoom();
        await enterRoom(page, roomId);

        // Act
        await (await seeder(roomId)).add([VIDEO_A]);
        await expect(metadata(page)).toBeVisible();

        // Assert
        const [playerBox, playlistBox] = [await boxOf(player(page)), await boxOf(playlistPanel(page))];
        expect(playlistBox.x).toBeGreaterThanOrEqual(playerBox.x + playerBox.width);
        expect(Math.abs(playlistBox.y - playerBox.y)).toBeLessThan(2);
    });

    test("mobile: player, playlist and metadata stack top to bottom", async ({ page, createRoom, seeder, isMobile }) => {
        test.skip(!isMobile, "mobile layout");

        // Arrange
        const roomId = await createRoom();
        await enterRoom(page, roomId);

        // Act
        await (await seeder(roomId)).add([VIDEO_A]);
        await expect(metadata(page)).toBeVisible();

        // Assert
        const [playerBox, playlistBox, metadataBox] = [await boxOf(player(page)), await boxOf(playlistPanel(page)), await boxOf(metadata(page))];
        expect(playlistBox.y).toBeGreaterThanOrEqual(playerBox.y + playerBox.height);
        expect(metadataBox.y).toBeGreaterThanOrEqual(playlistBox.y + playlistBox.height);
    });

    test("desktop: a long playlist of long titles doesn't move or resize the player and metadata", async ({ page, createRoom, seeder, isMobile }) => {
        test.skip(isMobile, "desktop layout");

        // Arrange
        const roomId = await createRoom();
        await enterRoom(page, roomId);
        const seed = await seeder(roomId);
        await seed.add([VIDEO_A]);
        await expect(metadata(page)).toBeVisible();
        const before = { player: await boxOf(player(page)), metadata: await boxOf(metadata(page)) };

        // Act
        await seed.add(LONG_VIDEOS);
        await expect(page.locator('h1[title^="An extremely long"]')).toHaveCount(LONG_VIDEOS.length);

        // Assert
        expect({ player: await boxOf(player(page)), metadata: await boxOf(metadata(page)) }).toEqual(before);
    });

    test("a long playlist stays within its max height and scrolls inside, without page overflow", async ({ page, createRoom, seeder, isMobile }) => {
        // Arrange
        const roomId = await createRoom();
        await enterRoom(page, roomId);

        // Act
        await (await seeder(roomId)).add([VIDEO_A, ...LONG_VIDEOS]);
        await expect(page.locator('h1[title^="An extremely long"]')).toHaveCount(LONG_VIDEOS.length);

        // Assert
        const panel = await boxOf(playlistPanel(page));
        const scroller = await playlistScroller(page).evaluate(el => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
        const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(panel.height).toBeLessThanOrEqual(isMobile ? PLAYLIST_MAX_HEIGHT.mobile : PLAYLIST_MAX_HEIGHT.desktop);
        expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
        expect(pageOverflow).toBeLessThanOrEqual(0);
    });

    test("selecting a row below the fold scrolls it into view inside the playlist", async ({ page, createRoom, seeder }) => {
        // Arrange
        const roomId = await createRoom();
        await enterRoom(page, roomId);
        const seed = await seeder(roomId);
        await seed.add([VIDEO_A, ...LONG_VIDEOS]);
        await expect(playlistRows(page)).toHaveCount(LONG_VIDEOS.length + 1);
        const lastRow = playlistRows(page).last();
        await expect(lastRow).not.toBeInViewport();

        // Act
        await seed.select(LONG_VIDEOS.length);

        // Assert
        await expect(lastRow).toBeInViewport();
    });

    test("an empty room shows the placeholder instead of the player", async ({ page, createRoom }) => {
        // Arrange
        const roomId = await createRoom();

        // Act
        await enterRoom(page, roomId);

        // Assert
        await expect(page.getByText("No video playing")).toBeVisible();
        await expect(player(page)).toBeHidden();
    });

    test("a loaded video shows the player instead of the placeholder", async ({ page, createRoom, seeder }) => {
        // Arrange
        const roomId = await createRoom();
        await enterRoom(page, roomId);

        // Act: wait for the metadata, the last thing a video load changes
        await (await seeder(roomId)).add([VIDEO_A]);
        await expect(metadata(page)).toBeVisible();

        // Assert
        await expect(player(page)).toBeVisible();
        await expect(page.getByText("No video playing")).toBeHidden();
    });

    test("the player shows even when the video's metadata can't be fetched", async ({ page, createRoom, seeder }) => {
        // Arrange
        const roomId = await createRoom();
        await enterRoom(page, roomId);

        // Act
        await (await seeder(roomId)).add([VIDEO_WITHOUT_METADATA]);
        await expect.poll(() => playerOf(page)).toMatchObject({ videoId: "fail0000001" });

        // Assert
        await expect(player(page)).toBeVisible();
    });
});


test.describe("chat layout", () => {
    test("the open chat panel fits inside the viewport", async ({ page, createRoom }) => {
        // Arrange
        const roomId = await createRoom();
        await enterRoom(page, roomId);

        // Act
        await chatButton(page).click();

        // Assert
        const panel = await boxOf(chatPanel(page));
        const viewport = page.viewportSize()!;
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.y).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
        expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
    });

    test("the chat scrolls to the newest message", async ({ page, createRoom, seeder }) => {
        // Arrange
        const roomId = await createRoom();
        await enterRoom(page, roomId);
        const seed = await seeder(roomId);
        await chatButton(page).click();

        // Act
        for (let i = 1; i <= 30; i++) seed.chat(`message ${i}`);

        // Assert
        await expect(page.getByText("message 30", { exact: true })).toBeInViewport();
        await expect(page.getByText("message 1", { exact: true })).not.toBeInViewport();
    });
});


test.describe("home layout", () => {
    test("the profile menu sits at the top right and the room controls below it, without horizontal scroll", async ({ page }) => {
        // Act
        await page.goto("/");
        const menu = page.getByTitle("Edit Profile");
        await expect(menu).toBeVisible();

        // Assert
        const [menuBox, createBox] = [await boxOf(menu), await boxOf(page.getByRole("button", { name: "Create Room" }))];
        const viewport = page.viewportSize()!;
        expect(menuBox.x + menuBox.width).toBeGreaterThan(viewport.width - 32);
        expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
        expect(createBox.y).toBeGreaterThanOrEqual(menuBox.y + menuBox.height);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    test("the open profile menu fits inside the viewport", async ({ page }) => {
        // Arrange
        await page.goto("/");

        // Act
        await page.getByTitle("Edit Profile").click();

        // Assert
        const panel = await boxOf(page.getByRole("textbox", { name: "Name" }).locator("xpath=../.."));
        const viewport = page.viewportSize()!;
        expect(panel.x).toBeGreaterThanOrEqual(0);
        expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
        expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
    });
});
