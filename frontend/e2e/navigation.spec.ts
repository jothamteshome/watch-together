import { expect, test } from "./fixtures";


test("Create Room opens a new, empty room", async ({ page }) => {
    // Arrange
    await page.goto("/");

    // Act
    await page.getByRole("button", { name: "Create Room" }).click();

    // Assert
    await expect(page).toHaveURL(/\/room\/[\w-]{8}$/);
    await expect(page.getByText("No video playing")).toBeVisible();
});


test("joining an existing room id opens that room", async ({ page, createRoom }) => {
    // Arrange
    const roomId = await createRoom();
    await page.goto("/");

    // Act
    await page.getByPlaceholder("Enter Room ID").fill(roomId);
    await page.getByRole("button", { name: "Join" }).click();

    // Assert
    await expect(page).toHaveURL(new RegExp(`/room/${roomId}$`));
    await expect(page.getByPlaceholder("Enter a url...")).toBeVisible();
});


test("joining an unknown room id stays home and marks the input invalid", async ({ page }) => {
    // Arrange
    await page.goto("/");
    const input = page.getByPlaceholder("Enter Room ID");

    // Act
    await input.fill("nope1234");
    await input.press("Enter");

    // Assert
    await expect(input).toHaveClass(/outline-red-600/);
    await expect(page).toHaveURL(/\/$/);
});


test("an unknown room shows Room Not Found, then returns home after the countdown", async ({ page }) => {
    // Arrange
    await page.clock.install();
    await page.goto("/room/nope1234");
    await expect(page.getByRole("heading", { name: "Room Not Found" })).toBeVisible();

    // Act
    await page.clock.runFor(5000);

    // Assert
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Create Room" })).toBeVisible();
});


test("a rename on the homepage is the name the user joins a room with", async ({ page }) => {
    // Arrange
    await page.goto("/");
    await page.getByTitle("Edit Profile").click();
    await page.getByRole("textbox", { name: "Name" }).fill("Home Guest");
    await page.getByRole("button", { name: "Save" }).click();

    // Act
    await page.getByRole("button", { name: "Create Room" }).click();
    await expect(page.getByPlaceholder("Enter a url...")).toBeVisible();

    // Assert
    await page.getByTitle("Online Users").click();
    await expect(page.getByRole("listitem").filter({ hasText: "Home Guest (you)" })).toBeVisible();
});
