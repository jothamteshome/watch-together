import { describe, expect, it, vi } from "vitest";
import { GENERATED_ICON_PREFIX, getOrCreateProfile, renameChanges, saveProfile } from "../../src/utils/identity";
import { BACKEND_URL, OTHER_USER, SELF_USER, seedProfile, stubFetch } from "../support/helpers";


const PROFILE_KEY = "watch-together:profile";

function storedProfile() {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)!);
}


describe("getOrCreateProfile", () => {
    it("returns the stored profile without asking the backend", async () => {
        // Arrange
        seedProfile();
        const fetchMock = stubFetch();

        // Act
        const profile = await getOrCreateProfile();

        // Assert
        expect(profile).toEqual(SELF_USER);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("generates a profile through the backend the first time, and stores it", async () => {
        // Arrange
        const fetchMock = stubFetch({ "/v1/users/generate": { body: OTHER_USER } });

        // Act
        const profile = await getOrCreateProfile();

        // Assert
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${BACKEND_URL}/v1/users/generate`);
        expect(profile).toEqual(OTHER_USER);
        expect(storedProfile()).toEqual(OTHER_USER);
    });

    it.each([
        {
            case: "storage is unavailable",
            arrange: () => {
                vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
                vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
            }
        },
        { case: "the stored profile is corrupt", arrange: () => localStorage.setItem(PROFILE_KEY, "{not json") }
    ])("still generates a profile when $case", async ({ arrange }) => {
        // Arrange
        stubFetch({ "/v1/users/generate": { body: OTHER_USER } });
        arrange();

        // Act
        const profile = await getOrCreateProfile();

        // Assert
        expect(profile).toEqual(OTHER_USER);
    });
});


describe("saveProfile", () => {
    it("stores the profile for later joins", () => {
        // Act
        saveProfile(SELF_USER);

        // Assert
        expect(storedProfile()).toEqual(SELF_USER);
    });

    it("doesn't throw when storage is unavailable", () => {
        // Arrange
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });

        // Act + Assert
        expect(() => saveProfile(SELF_USER)).not.toThrow();
    });
});

describe("renameChanges", () => {
    it("moves a generated icon to the new name, encoding it for the URL", () => {
        // Arrange
        const user = { ...SELF_USER, icon: `${GENERATED_ICON_PREFIX}OldName` };

        // Act
        const changes = renameChanges(user, "New Name & Co");

        // Assert
        expect(changes).toEqual({ username: "New Name & Co", icon: `${GENERATED_ICON_PREFIX}New%20Name%20%26%20Co` });
    });

    it("leaves a custom icon alone, sending only the name", () => {
        // Act
        const changes = renameChanges(SELF_USER, "New Name");

        // Assert
        expect(changes).toEqual({ username: "New Name" });
    });
});
