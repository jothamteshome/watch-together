/** Payload for `user:updated` events sent by a client to change its own profile */
export interface UserUpdateEvent {
    username?: string;
    icon?: string;
}
