import type User from "@shared/interfaces/User";
import type { UserUpdateEvent } from "@shared/interfaces/UserEvents";

const PROFILE_STORAGE_KEY = "watch-together:profile";

// Keep in sync with the icon URL in backend/src/utils/generateUser.ts
export const GENERATED_ICON_PREFIX = "https://api.dicebear.com/7.x/identicon/svg?seed=";

async function fetchGeneratedUser(): Promise<User> {
    const response = await fetch(`${import.meta.env.VITE_APP_BACKEND_URL}/v1/users/generate`);
    return response.json();
}

/**
 * The profile changes for renaming `user`. A generated icon is seeded by the username, so it follows
 * the rename; any other icon is left alone.
 */
export function renameChanges(user: User, username: string): UserUpdateEvent {
    if (!user.icon.startsWith(GENERATED_ICON_PREFIX)) return { username };

    return { username, icon: GENERATED_ICON_PREFIX + encodeURIComponent(username) };
}

/**
 * Persists this browser's profile so it's resent on every room join.
 */
export function saveProfile(profile: User): void {
    try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
        // can't persist — a fresh profile will be generated again next time
    }
}

/**
 * Returns this browser's persisted profile, generating and storing a random
 * one (via the backend) the first time it's needed.
 */
export async function getOrCreateProfile(): Promise<User> {
    try {
        const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch {
        // localStorage unavailable (e.g. private browsing) — fall through to generating a fresh profile
    }

    const profile: User = await fetchGeneratedUser();
    saveProfile(profile);

    return profile;
}
