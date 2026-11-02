import type User from "@shared/interfaces/User";



/**
 * Client-side directory of the users currently known in the room, keyed by userId.
 */
export default class UsersManager {
    private users: Map<string, User> = new Map<string, User>();


    public setUser(user: User) {
        this.users.set(user.id, user);
    }


    public getUser(userId: string): User | undefined {
        return this.users.get(userId);
    }


    /**
     * Replaces the whole directory (used when a full room snapshot arrives).
     */
    public hydrate(users: Record<string, User>) {
        this.users = new Map(Object.entries(users));
    }
}
