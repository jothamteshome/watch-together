import type { Server, Socket } from "socket.io";
import type { VideoUpdateEvent } from "@shared/interfaces/VideoEvents";
import type { VideoState } from "@shared/interfaces/States";
import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import { serverManager } from "../models/RoomManager.js";


/**
 * Projects the room's video state forward to now for a joining client, and re-anchors the
 * stored state to the same moment
 * @param roomId    The room being joined
 * @returns The state to send the joiner, or null if the room has none
 */
export function getJoinVideoState(roomId: string): VideoState | null {
    const videoState: VideoState | null = serverManager.getVideoState(roomId);
    if (!videoState) return null;

    const elapsed = videoState.isPlaying ? (Date.now() - videoState.lastUpdate) / 1000 : 0;

    const newState: VideoState = {
        ...videoState,
        currentTime: videoState.currentTime + elapsed,
        lastUpdate: Date.now()
    };

    serverManager.serverRooms.get(roomId)?.setVideoState(newState);

    console.log("Video state", newState);
    return newState;
}


/**
 * Start a playlist item for the whole room. Called by the playlist handlers; clients never
 * start videos themselves.
 * @param io        The server instance handling events
 * @param roomId    The room to start the video in
 * @param item      The playlist item to load, from 0:00
 */
export function setVideoItem(io: Server, roomId: string, item: PlaylistItem) {
    console.log(`Setting video: ${item.videoUrl} in ${roomId}`);

    const videoState: VideoState | null = serverManager.getVideoState(roomId);
    if (!videoState) return;

    videoState.eventId += 1;
    videoState.itemId = item.id;
    videoState.videoUrl = item.videoUrl;
    videoState.videoService = item.videoService;
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
    socket.on("video:play", (event: VideoUpdateEvent) => handlePlayVideo(io, event));
    socket.on("video:pause", (event: VideoUpdateEvent) => handlePauseVideo(io, event));
    socket.on("video:seek", (event: VideoUpdateEvent) => handleUpdateVideo(io, event));
    socket.on("video:playbackrate", (event: VideoUpdateEvent) => handleUpdateVideo(io, event));
}