import type User from "./User";

/** Interface for `room:join` events */
export interface RoomJoinEvent {
    roomId: string;
    user: User;
}
