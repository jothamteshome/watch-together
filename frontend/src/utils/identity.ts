import type User from "@shared/interfaces/User";

const PROFILE_STORAGE_KEY = "watch-together:profile";

async function fetchGeneratedUser(): Promise<User> {
    const response = await fetch(`${import.meta.env.VITE_APP_BACKEND_URL}/v1/users/generate`);
    return response.json();
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

    try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
        // can't persist — a fresh profile will be generated again next time
    }

    return profile;
}
