import type { RoomUsers } from "../interfaces/RoomUsers.js";
import type { VideoState, PlaylistState } from "../interfaces/States.js";
import type User from "../interfaces/User.js";
import type { VideoData } from "../interfaces/VideoData.js";


class RoomManager {
    public roomUsers: RoomUsers = {};
    public userObjects: Map<string, User> = new Map<string, User>();
    public cachedVideoData: Map<string, VideoData> = new Map<string, VideoData>();
    public playlistStates: Map<string, PlaylistState> = new Map<string, PlaylistState>();
    public videoStates: Map<string, VideoState> = new Map<string, VideoState>();


    constructor() {
        const systemUser: User = {
            id: 'system',
            username: "[SYSTEM]",
            icon: `https://api.dicebear.com/7.x/identicon/svg?seed=system`
        }

        this.userObjects.set('system', systemUser);
    }


    public createRoom(roomId: string) {
        // Set room state
        this.videoStates.set(roomId, {
            eventId: 0,
            videoUrl: null,
            currentTime: 0,
            isPlaying: false,
            playbackRate: 1,
            lastUpdate: Date.now()
        });


        // Set playlist state
        this.playlistStates.set(roomId, {
            eventId: 0,
            items: [],
            currentIndex: -1,
            isLooping: false
        });
    }
};


export const roomManager = new RoomManager();