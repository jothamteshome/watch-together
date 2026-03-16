import type { Server, Socket } from "socket.io";
import type { VideoSetEvent, VideoUpdateEvent } from "../interfaces/VideoEvents.js";
import type { VideoState } from "../interfaces/States.js";
import { serverManager } from "../models/RoomManager.js";


export function handleVideoJoinRoomSync(socket: Socket, roomId: string) {
    const videoState: VideoState | null = serverManager.getVideoState(roomId);
    if (!videoState) return;

    const elapsed = videoState.isPlaying ? (Date.now() - videoState.lastUpdate) / 1000 : 0;

    const newState: VideoState = {
        ...videoState,
        currentTime: videoState.currentTime + elapsed,
        lastUpdate: Date.now()
    };

    serverManager.serverRooms.get(roomId)?.setVideoState(newState);

    console.log("Video state", newState);
    socket.emit("video:sync", newState);
}


/**
 * Handle video set events from socket.IO
 * @param io                        The server instance handling events
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.videoUrl       The URL of the new video
 * @param videoEvent.videoService   The service the video belongs to
 */
function handleSetVideo(io: Server, { roomId, videoUrl, videoService }: VideoSetEvent) {
    console.log(`Setting video: ${videoUrl} in ${roomId}`);

    const videoState: VideoState | null = serverManager.getVideoState(roomId);
    if (!videoState) return;

    videoState.eventId += 1;
    videoState.videoUrl = videoUrl;
    videoState.videoService = videoService ?? null;
    videoState.currentTime = 0;
    videoState.isPlaying = true;
    videoState.playbackRate = 1;
    videoState.lastUpdate = Date.now();

    console.log(videoState);
    io.to(roomId).emit("video:sync", videoState);
}


/**
 * Handle video play events from socket.IO
 * @param io                        The server instance handling events
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.time           The timestamp to set the video to
 * @param videoEvent.playbackRate   The playback rate of the video
 * @param videoEvent.eventId        The eventId of the video event
 */
function handlePlayVideo(io: Server, { roomId, time, playbackRate, eventId }: VideoUpdateEvent) {
    const videoState: VideoState | null = serverManager.getVideoState(roomId);
    if (!videoState) return;

    if (videoState.eventId > eventId) return;

    videoState.eventId++;
    videoState.currentTime = time;
    videoState.isPlaying = true;
    videoState.playbackRate = playbackRate;
    videoState.lastUpdate = Date.now();

    console.log(`Broadcasting video:play in room ${roomId} at time ${time}`);
    io.to(roomId).emit("video:sync", videoState);
}


/**
 * Handle video pause events from socket.IO
 * @param io                        The server instance handling events
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.time           The timestamp to set the video to
 * @param videoEvent.playbackRate   The playback rate of the video
 * @param videoEvent.eventId        The eventId of the video event
 */
function handlePauseVideo(io: Server, { roomId, time, playbackRate, eventId }: VideoUpdateEvent) {
    const videoState: VideoState | null = serverManager.getVideoState(roomId);
    if (!videoState) return;

    if (videoState.eventId > eventId) return;

    videoState.eventId++;
    videoState.currentTime = time;
    videoState.isPlaying = false;
    videoState.playbackRate = playbackRate;
    videoState.lastUpdate = Date.now();

    console.log(`Broadcasting video:pause in room ${roomId} at time ${time}`);
    io.to(roomId).emit("video:sync", videoState);
}


/**
 * Handle general video update events from socket.IO
 * @param io                        The server instance handling events
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.time           The timestamp to set the video to
 * @param videoEvent.playbackRate   The playback rate of the video
 * @param videoEvent.eventId        The eventId of the video event
 */
function handleUpdateVideo(io: Server, { roomId, time, playbackRate, eventId }: VideoUpdateEvent) {
    const videoState: VideoState | null = serverManager.getVideoState(roomId);
    if (!videoState) return;

    if (videoState.eventId > eventId) return;

    videoState.eventId++;
    videoState.currentTime = time;
    videoState.playbackRate = playbackRate;
    videoState.lastUpdate = Date.now();

    console.log(`Broadcasting video:update in room ${roomId} at time ${time}`);
    io.to(roomId).emit("video:sync", videoState);
}


export function registerVideoEventHandlers(io: Server, socket: Socket) {
    socket.on("video:set", (event: VideoSetEvent) => handleSetVideo(io, event));
    socket.on("video:play", (event: VideoUpdateEvent) => handlePlayVideo(io, event));
    socket.on("video:pause", (event: VideoUpdateEvent) => handlePauseVideo(io, event));
    socket.on("video:seek", (event: VideoUpdateEvent) => handleUpdateVideo(io, event));
    socket.on("video:playbackrate", (event: VideoUpdateEvent) => handleUpdateVideo(io, event));
}