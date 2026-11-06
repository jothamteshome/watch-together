import { describe, expect, it, vi } from "vitest";
import UsersManager from "../../src/managers/UsersManager";
import { OTHER_USER, SELF_USER } from "../support/helpers";


function createManager() {
    const onChange = vi.fn();
    const manager = new UsersManager(onChange);
    return { manager, onChange };
}


describe("UsersManager", () => {
    it("replaces the whole directory with a snapshot's users and reports them", () => {
        // Arrange
        const { manager, onChange } = createManager();
        manager.setUser(OTHER_USER);

        // Act
        manager.hydrate({ [SELF_USER.id]: SELF_USER });

        // Assert
        expect(onChange).toHaveBeenLastCalledWith([SELF_USER]);
        expect(manager.getUser(OTHER_USER.id)).toBeUndefined();
    });

    it("adds or replaces one user by id and reports the full list", () => {
        // Arrange
        const { manager, onChange } = createManager();
        manager.hydrate({ [SELF_USER.id]: SELF_USER, [OTHER_USER.id]: OTHER_USER });
        const renamed = { ...OTHER_USER, username: "Renamed" };

        // Act
        manager.setUser(renamed);

        // Assert
        expect(onChange).toHaveBeenLastCalledWith([SELF_USER, renamed]);
        expect(manager.getUser(OTHER_USER.id)).toEqual(renamed);
    });

    it("removes a user and reports the list, but stays quiet for a user it doesn't know", () => {
        // Arrange
        const { manager, onChange } = createManager();
        manager.hydrate({ [SELF_USER.id]: SELF_USER, [OTHER_USER.id]: OTHER_USER });
        onChange.mockClear();

        // Act
        manager.removeUser("no-such-user");
        const callsForUnknown = onChange.mock.calls.length;
        manager.removeUser(OTHER_USER.id);

        // Assert
        expect(callsForUnknown).toBe(0);
        expect(onChange).toHaveBeenCalledExactlyOnceWith([SELF_USER]);
    });
});
