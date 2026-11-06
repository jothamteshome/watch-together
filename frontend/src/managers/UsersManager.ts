import type User from "@shared/interfaces/User";



/**
 * Client-side directory of the users currently known in the room, keyed by userId.
 * Reports the full user list to the UI whenever it changes.
 */
export default class UsersManager {
    private users: Map<string, User> = new Map<string, User>();
    private onChange: (users: User[]) => void;


    constructor(onChange: (users: User[]) => void) {
        this.onChange = onChange;
    }


    public setUser(user: User) {
        this.users.set(user.id, user);
        this.notify();
    }


    public removeUser(userId: string) {
        if (this.users.delete(userId)) this.notify();
    }


    public getUser(userId: string): User | undefined {
        return this.users.get(userId);
    }


    /**
     * Replaces the whole directory (used when a full room snapshot arrives).
     */
    public hydrate(users: Record<string, User>) {
        this.users = new Map(Object.entries(users));
        this.notify();
    }


    private notify() {
        this.onChange([...this.users.values()]);
    }
}
