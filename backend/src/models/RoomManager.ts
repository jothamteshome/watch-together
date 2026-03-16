import RoomState from "./RoomState.js";
import type { VideoState, PlaylistState } from "../interfaces/States.js";
import type User from "../interfaces/User.js";
import type { VideoData } from "../interfaces/VideoData.js";


class ServerManager {
    public serverUsers: Map<string, User> = new Map<string, User>();
    public videoCache: Map<string, VideoData> = new Map<string, VideoData>();
    public serverRooms: Map<string, RoomState> = new Map<string, RoomState>();


    constructor() {
        const systemUser: User = {
            id: 'system',
            username: "[SYSTEM]",
            icon: `https://api.dicebear.com/7.x/identicon/svg?seed=system`
        }

        this.serverUsers.set('system', systemUser);
    }


    public createRoom(roomId: string) {
        const roomState: RoomState = new RoomState();

        const videoState: VideoState = {
            eventId: 0,
            videoUrl: null,
            videoService: null,
            currentTime: 0,
            isPlaying: false,
            playbackRate: 1,
            lastUpdate: Date.now()
        }

        const playlistState: PlaylistState = {
            eventId: 0,
            items: [],
            currentIndex: -1,
            isLooping: false
        }

        roomState.setVideoState(videoState);
        roomState.setPlaylistState(playlistState);

        serverManager.serverRooms.set(roomId, roomState);
    }


    /**
     * Returns the VideoState for a room, or null if the room or its state doesn't exist.
     */
    public getVideoState(roomId: string): VideoState | null {
        const roomState = this.serverRooms.get(roomId);
        if (!roomState) {
            console.log(`Room ${roomId} does not exist`);
            return null;
        }
        const videoState = roomState.getVideoState();
        if (!videoState) {
            console.log(`Video state for room ${roomId} does not exist`);
            return null;
        }
        return videoState;
    }


    /**
     * Returns the PlaylistState for a room, or null if the room or its state doesn't exist.
     */
    public getPlaylistState(roomId: string): PlaylistState | null {
        const roomState = this.serverRooms.get(roomId);
        if (!roomState) {
            console.log(`Room ${roomId} does not exist`);
            return null;
        }
        const playlistState = roomState.getPlaylistState();
        if (!playlistState) {
            console.log(`Playlist state for room ${roomId} does not exist`);
            return null;
        }
        return playlistState;
    }
};


export const serverManager = new ServerManager();