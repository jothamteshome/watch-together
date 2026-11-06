import { BaseVideoManager } from "./BaseVideoManager";
import ChatManager from "./ChatManager";
import PlaylistManager from "./PlaylistManager";
import UsersManager from "./UsersManager";
import YoutubeManager from "./YoutubeManager";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type RoomSnapshot from "@shared/interfaces/RoomSnapshot";
import type User from "@shared/interfaces/User";
import type { UserUpdateEvent } from "@shared/interfaces/UserEvents";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";
import type { PlaylistState, VideoState } from "@shared/interfaces/States";
import type { VideoService } from "@shared/interfaces/VideoService";
import { socket } from "../services/socket";
import { getOrCreateProfile, saveProfile } from "../utils/identity";



/**
 * Manages video playback and synchronization for a room.
 * Acts as a coordinator between socket events and video service managers (e.g. YouTube).
 *
 * Service-specific logic (URL detection, video loading, info fetching) is fully
 * delegated to the individual managers, keeping this class service-agnostic.
 */
export default class RoomManager {
    private roomId: string;
    private currentVideoUrl?: string;
    private currentItemId: string | null = null;
    private currentService?: VideoService;
    private currentManager?: BaseVideoManager;
    private videoManagers: Record<VideoService, BaseVideoManager>;
    private playlistManager: PlaylistManager;
    private chatManager: ChatManager;
    private usersManager: UsersManager;
    private selfUser?: User;
    private onVideoChange: () => void;
    private updateSelfUserUI: (user: User) => void;
    private isDestroyed = false;



    constructor(
        roomId: string,
        onVideoChange: () => void,
        updatePlaylistUI: (items: PlaylistItem[], index: number) => void,
        updateChatUI: (messages: ChatMessage[], isHistory: boolean) => void,
        updateSelfUserUI: (user: User) => void,
        updateUsersUI: (users: User[]) => void
    ) {
        this.roomId = roomId;
        this.onVideoChange = onVideoChange;
        this.updateSelfUserUI = updateSelfUserUI;

        this.videoManagers = {
            youtube: new YoutubeManager(this.roomId, this.onVideoEnd)
        };

        this.playlistManager = new PlaylistManager(updatePlaylistUI);
        this.chatManager = new ChatManager(updateChatUI);
        this.usersManager = new UsersManager(updateUsersUI);

        this.registerSocketEvents();
        this.joinRoom();
    }


    /**
     * The current user's id, or undefined until their profile has been resolved in joinRoom().
     */
    get selfUserId(): string | undefined {
        return this.selfUser?.id;
    }


    private registerSocketEvents = (): void => {
        socket.on("video:sync", (state: VideoState) => this.syncVideo(state));
        socket.on("playlist:sync", (state: PlaylistState) => this.playlistManager.sync(state));
        socket.on("chat:sync", (msg: ChatMessage) => this.chatManager.add(msg));
        socket.on("room:sync", (snapshot: RoomSnapshot) => this.handleRoomSync(snapshot));
        socket.on("user:joined", (user: User) => this.usersManager.setUser(user));
        socket.on("user:updated", (user: User) => this.handleUserUpdated(user));
        socket.on("user:left", (userId: string) => this.usersManager.removeUser(userId));
    };


    /**
     * Applies a server-confirmed profile change. If it's this client's own user (including
     * a rename made from another tab), the local profile is refreshed and persisted too.
     */
    private handleUserUpdated = (user: User): void => {
        this.usersManager.setUser(user);

        if (user.id !== this.selfUser?.id) return;

        this.selfUser = user;
        saveProfile(user);
        this.updateSelfUserUI(user);
    };


    private handleRoomSync = (snapshot: RoomSnapshot): void => {
        this.usersManager.hydrate(snapshot.users);
        this.chatManager.hydrate(snapshot.chatHistory);

        // The video loads locally at the projected time and nothing is broadcast
        if (snapshot.playlist) this.playlistManager.sync(snapshot.playlist);
        if (snapshot.video) this.syncVideo(snapshot.video);
    };


    /**
     * Connects the socket (if needed) and joins the room. Room membership is
     * independent of any specific video service's player lifecycle.
     */
    private joinRoom = async (): Promise<void> => {
        const user: User = await getOrCreateProfile();

        if (this.isDestroyed) return;

        this.selfUser = user;
        this.updateSelfUserUI(user);

        if (!socket.connected) {
            socket.connect();
            socket.once("connect", () => this.emitJoin(user));
        } else {
            this.emitJoin(user);
        }
    };


    private emitJoin = (user: User): void => {
        if (this.isDestroyed) return;

        socket.emit("room:join", { roomId: this.roomId, user });
    };


    /**
     * Syncs the local player with the server-provided video state.
     * If the playlist item changed, loads the new video; otherwise applies drift correction only.
     */
    private syncVideo = async (state: VideoState): Promise<void> => {
        if (!state.videoUrl) return;

        const manager = state.videoService
            ? this.videoManagers[state.videoService]
            : this.getManagerForUrl(state.videoUrl);
        if (!manager) return;

        manager.ensureInitialized(`${manager.getServiceName()}-player`);

        if (this.currentManager && this.currentManager !== manager) {
            this.currentManager.pause();
        }
        this.currentManager = manager;

        const itemChanged = state.itemId !== this.currentItemId;
        this.currentItemId = state.itemId;
        this.currentVideoUrl = state.videoUrl;
        this.currentService = manager.getServiceName();

        // The manager may still be initializing (e.g. waiting on the YouTube iframe
        // API to load) — wait until it's actually ready before loading/syncing.
        await manager.whenReady();

        if (itemChanged) {
            manager.loadVideo(state.videoUrl, state);
            this.onVideoChange();
        } else {
            manager.sync(state);
        }
    };


    /**
     * Finds the manager that can handle the given URL.
     * Returns null without alerting if no manager supports the URL.
     */
    public getManagerForUrl = (videoUrl: string): BaseVideoManager | null => {
        return Object.values(this.videoManagers).find(manager => manager.canHandle(videoUrl)) ?? null;
    };


    /**
     * Finds the manager that can handle the given URL.
     * Alerts the user and returns null if no manager supports the URL.
     */
    private resolveManager = (videoUrl: string): BaseVideoManager | null => {
        const manager = this.getManagerForUrl(videoUrl);
        if (!manager) alert(`Unsupported video URL: ${videoUrl}`);
        return manager;
    };


    private onVideoEnd = (): void => {
        if (!this.currentItemId) return;
        socket.emit("playlist:next", { roomId: this.roomId, itemId: this.currentItemId });
    };


    /**
     * Adds a video to the room's playlist after validating the URL.
     */
    public queueVideo = (videoUrl: string): void => {
        const manager = this.resolveManager(videoUrl);
        if (!manager) return;
        socket.emit("playlist:add", { roomId: this.roomId, videoUrl, videoService: manager.getServiceName() });
    };


    public sendChatMessage = (msg: string): void => {
        socket.emit("chat:message", { roomId: this.roomId, msg });
    };


    /**
     * Requests a change to this user's name and/or icon. The local profile is only updated
     * (and persisted) once the server confirms it via user:updated, so a rejected change
     * never ends up in localStorage.
     */
    public updateProfile = (changes: UserUpdateEvent): void => {
        socket.emit("user:updated", changes);
    };


    /**
     * Fetches metadata for the currently active video from the appropriate service manager.
     * Returns null if no video is loaded or the fetch fails.
     */
    public fetchCurrentVideoInfo = async (): Promise<VideoInfo | null> => {
        if (!this.currentVideoUrl || !this.currentService) return null;
        const manager = this.videoManagers[this.currentService];
        if (!manager) return null;
        return manager.fetchVideoInfo(this.currentVideoUrl);
    };


    /**
     * Fetches metadata for an arbitrary video URL (e.g. a playlist item that isn't
     * the currently active video) using whichever manager supports it.
     */
    public fetchVideoInfoForUrl = async (videoUrl: string): Promise<VideoInfo | null> => {
        const manager = this.getManagerForUrl(videoUrl);
        if (!manager) return null;
        return manager.fetchVideoInfo(videoUrl);
    };


    /**
     * Selects a specific video in the playlist by index.
     */
    public selectPlaylistVideo = (index: number): void => {
        socket.emit("playlist:select", { roomId: this.roomId, index });
    };


    destroy() {
        this.isDestroyed = true;
        socket.emit("room:leave", { roomId: this.roomId });

        socket.off("playlist:sync");
        socket.off("video:sync");
        socket.off("chat:sync");
        socket.off("room:sync");
        socket.off("user:joined");
        socket.off("user:updated");
        socket.off("user:left");
        Object.values(this.videoManagers).forEach(manager => manager.destroy());
    }
}
