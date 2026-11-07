import RoomState from "./RoomState.js";
import { logger } from "../utils/logger.js";
import type User from "@shared/interfaces/User";
import type { UserUpdateEvent } from "@shared/interfaces/UserEvents";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";

const ROOM_EMPTY_DELETE_DELAY_MS = 1000 * 60 * 60; // 1 hour


class ServerManager {
    public serverUsers: Map<string, User> = new Map<string, User>(); // userId -> User
    public userSockets: Map<string, Set<string>> = new Map<string, Set<string>>(); // userId -> Set<socketId>
    public socketUserIds: Map<string, string> = new Map<string, string>(); // socketId -> userId
    public videoCache: Map<string, VideoInfo> = new Map<string, VideoInfo>();
    public serverRooms: Map<string, RoomState> = new Map<string, RoomState>();


    public createRoom(roomId: string) {
        serverManager.serverRooms.set(roomId, new RoomState());
        this.scheduleRoomDeletion(roomId);
    }


    /**
     * Schedules an empty room for deletion. RoomState.addUser() cancels this when someone
     * joins, so it only fires for a room nobody ever joined or that has since emptied.
     */
    public scheduleRoomDeletion(roomId: string): void {
        this.serverRooms.get(roomId)?.scheduleDeletion(() => {
            this.serverRooms.delete(roomId);
            logger.info({ roomId }, "Room deleted because it is empty");
        }, ROOM_EMPTY_DELETE_DELAY_MS);
    }


    /**
     * Associates a socket connection with a user profile. The client owns
     * and persists this profile (see frontend identity.ts), so the server
     * just mirrors whatever it's sent rather than generating/remembering
     * one itself.
     */
    public registerConnection(socketId: string, user: User): void {
        this.serverUsers.set(user.id, user);
        this.socketUserIds.set(socketId, user.id);

        let sockets = this.userSockets.get(user.id);
        if (!sockets) {
            sockets = new Set<string>();
            this.userSockets.set(user.id, sockets);
        }
        sockets.add(socketId);
    }


    /**
     * Returns the User profile associated with a socket connection, if any.
     */
    public getUserBySocket(socketId: string): User | undefined {
        const userId = this.socketUserIds.get(socketId);
        return userId ? this.serverUsers.get(userId) : undefined;
    }


    /**
     * Applies a profile change for the user behind a socket and returns the updated profile.
     *
     * This deliberately replaces the stored User with a new object instead of editing
     * it in place: the old object is still referenced by every ChatMessage that user
     * has sent, and those messages must keep the name/icon they were sent with.
     */
    public updateUser(socketId: string, changes: UserUpdateEvent): User | undefined {
        const user = this.getUserBySocket(socketId);
        if (!user) return undefined;

        const updatedUser: User = { ...user, ...changes };
        this.serverUsers.set(user.id, updatedUser);
        return updatedUser;
    }


    /**
     * Unregisters a socket connection. The underlying profile is only removed
     * once no other socket is still connected as that same userId.
     */
    public disconnectSocket(socketId: string): void {
        const userId = this.socketUserIds.get(socketId);
        this.socketUserIds.delete(socketId);
        if (!userId) return;

        const sockets = this.userSockets.get(userId);
        sockets?.delete(socketId);

        if (!sockets || sockets.size === 0) {
            this.userSockets.delete(userId);
            this.serverUsers.delete(userId);
        }
    }
};


export const serverManager = new ServerManager();