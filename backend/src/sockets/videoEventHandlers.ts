import type { Server, Socket } from "socket.io";
import type { VideoSetEvent, VideoUpdateEvent } from "../interfaces/VideoEvents.js";
import type { VideoState } from "../interfaces/States.js";
import { serverManager } from "../models/RoomManager.js";
import type RoomState from "../interfaces/RoomState.js";


export function handleVideoJoinRoomSync(socket: Socket, roomId: string) {
    // If room state doesn't exist, return
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) {
        console.log(`Room state ${roomId} does not exist`);
        return;
    }


    // If video state doesn't exist, return
    const videoState: VideoState | null = roomState.getVideoState();
    if (!videoState) {
        console.log(`Playlist for room ${roomId} does not exist`);
        return;
    }

    const oldLastUpdate = videoState.lastUpdate;
    const elapsed = videoState.isPlaying ? (Date.now() - oldLastUpdate) / 1000 : 0;

    // Construct new state
    const newState: VideoState = {
        eventId: videoState.eventId,
        videoUrl: videoState?.videoUrl,
        currentTime: videoState.currentTime + elapsed,
        isPlaying: videoState.isPlaying,
        playbackRate: videoState.playbackRate,
        lastUpdate: Date.now()
    };

    // Set new state
    serverManager.serverRooms.get(roomId)?.setVideoState(newState);

    // Sync client
    console.log("Video state", newState)
    socket.emit("video:sync", newState);
}


/**
 * Handle video set events from socket.IO
 * @param io                    The server instance handling events
 * @param videoEvent.roomId     The current roomId to handle events for
 * @param videoEvent.videoUrl   The id of the new video
 */
function handleSetVideo(io: Server, { roomId, videoUrl }: { roomId: string, videoUrl: string }) {
    console.log(`Setting video: ${videoUrl} in ${roomId}`);

    // If room state doesn't exist, return
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) {
        console.log(`Room state ${roomId} does not exist`);
        return;
    }


    // If video state doesn't exist, return
    const videoState: VideoState | null = roomState.getVideoState();
    if (!videoState) {
        console.log(`Playlist for room ${roomId} does not exist`);
        return;
    }

    // Update video state with new video
    videoState.eventId += 1
    videoState.videoUrl = videoUrl;
    videoState.currentTime = 0;
    videoState.isPlaying = true;
    videoState.playbackRate = 1;
    videoState.lastUpdate = Date.now();

    // Broadcast the new video state to all users in the room
    console.log(videoState);
    io.to(roomId).emit("video:sync", videoState);
};


/**
 * Handle video pause events from socket.IO
 * @param io                        The server instance handling events
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.time           The timestamp to set the video to
 * @param videoEvent.playbackRate   The playback rate of the video
 * @param videoEvent.eventId        The eventId of the video event
 */
function handlePlayVideo(io: Server, { roomId, time, playbackRate, eventId }: VideoUpdateEvent) {
    // If room state doesn't exist, return
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) {
        console.log(`Room state ${roomId} does not exist`);
        return;
    }


    // If video state doesn't exist, return
    const videoState: VideoState | null = roomState.getVideoState();
    if (!videoState) {
        console.log(`Playlist for room ${roomId} does not exist`);
        return;
    }

    // Ignore sync events if the eventId is less than or equal to what is known to the server
    if (videoState.eventId > eventId) return;

    // Update room's state on server
    videoState.eventId++;
    videoState.currentTime = time;
    videoState.isPlaying = true;
    videoState.playbackRate = playbackRate;
    videoState.lastUpdate = Date.now();

    console.log(`Broadcasting video:play in room ${roomId} at time ${time}`);
    console.log(videoState);
    io.to(roomId).emit("video:sync", videoState);
};


/**
 * Handle video pause events from socket.IO
 * @param io                        The server instance handling events
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.time           The timestamp to set the video to
 * @param videoEvent.playbackRate   The playback rate of the video
 * @param videoEvent.eventId        The eventId of the video event
 */
function handlePauseVideo(io: Server, { roomId, time, playbackRate, eventId }: VideoUpdateEvent) {
    // If room state doesn't exist, return
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) {
        console.log(`Room state ${roomId} does not exist`);
        return;
    }


    // If video state doesn't exist, return
    const videoState: VideoState | null = roomState.getVideoState();
    if (!videoState) {
        console.log(`Playlist for room ${roomId} does not exist`);
        return;
    }

    // Ignore sync events if the eventId is less than or equal to what is known to the server
    if (videoState.eventId > eventId) return;

    // Update room's state on server
    videoState.eventId++;
    videoState.currentTime = time;
    videoState.isPlaying = false;
    videoState.playbackRate = playbackRate;
    videoState.lastUpdate = Date.now();


    console.log(`Broadcasting video:pause in room ${roomId} at time ${time}`);
    console.log(videoState);
    io.to(roomId).emit("video:sync", videoState);
};


/**
 * Handle general video update events from socket.IO
 * @param io                        The server instance handling events
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.time           The timestamp to set the video to
 * @param videoEvent.playbackRate   The playback rate of the video
 * @param videoEvent.eventId        The eventId of the video event
 */
function handleUpdateVideo(io: Server, { roomId, time, playbackRate, eventId }: VideoUpdateEvent) {
    // If room state doesn't exist, return
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) {
        console.log(`Room state ${roomId} does not exist`);
        return;
    }


    // If video state doesn't exist, return
    const videoState: VideoState | null = roomState.getVideoState();
    if (!videoState) {
        console.log(`Playlist for room ${roomId} does not exist`);
        return;
    }

    // Ignore sync events if the eventId is less than or equal to what is known to the server
    if (videoState.eventId > eventId) return;


    // Update video's state on server
    videoState.eventId++;
    videoState.currentTime = time;
    videoState.playbackRate = playbackRate;
    videoState.lastUpdate = Date.now();

    console.log(`Broadcasting video:update in room ${roomId} at time ${time}`);
    console.log(videoState);
    io.to(roomId).emit("video:sync", videoState);
};


export function registerVideoEventHandlers(io: Server, socket: Socket) {
    // Video events
    socket.on("video:set", ({ roomId, videoUrl }: VideoSetEvent) => handleSetVideo(io, { roomId, videoUrl }));
    socket.on("video:play", (event: VideoUpdateEvent) => handlePlayVideo(io, event));
    socket.on("video:pause", (event: VideoUpdateEvent) => handlePauseVideo(io, event));
    socket.on("video:seek", (event: VideoUpdateEvent) => handleUpdateVideo(io, event));
    socket.on("video:playbackrate", (event: VideoUpdateEvent) => handleUpdateVideo(io, event));
}