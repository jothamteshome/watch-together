import RoomState from "../interfaces/RoomState.js";
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
};


export const serverManager = new ServerManager();