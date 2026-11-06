import type { Server, Socket } from "socket.io";
import type { VideoUpdateEvent } from "@shared/interfaces/VideoEvents";
import { serverManager } from "../models/RoomManager.js";
import type RoomState from "../models/RoomState.js";


/**
 * Handle video play events from socket.IO
 * @param io                        The server instance handling events
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.time           The timestamp to set the video to
 * @param videoEvent.playbackRate   The playback rate of the video
 * @param videoEvent.eventId        The eventId of the video event
 */
function handlePlayVideo(io: Server, { roomId, time, playbackRate, eventId }: VideoUpdateEvent) {
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState?.updateVideo(eventId, time, playbackRate, true)) return;

    console.log(`Broadcasting video:play in room ${roomId} at time ${time}`);
    io.to(roomId).emit("video:sync", roomState.getVideoState());
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
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState?.updateVideo(eventId, time, playbackRate, false)) return;

    console.log(`Broadcasting video:pause in room ${roomId} at time ${time}`);
    io.to(roomId).emit("video:sync", roomState.getVideoState());
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
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState?.updateVideo(eventId, time, playbackRate)) return;

    console.log(`Broadcasting video:update in room ${roomId} at time ${time}`);
    io.to(roomId).emit("video:sync", roomState.getVideoState());
}


export function registerVideoEventHandlers(io: Server, socket: Socket) {
    socket.on("video:play", (event: VideoUpdateEvent) => handlePlayVideo(io, event));
    socket.on("video:pause", (event: VideoUpdateEvent) => handlePauseVideo(io, event));
    socket.on("video:seek", (event: VideoUpdateEvent) => handleUpdateVideo(io, event));
    socket.on("video:playbackrate", (event: VideoUpdateEvent) => handleUpdateVideo(io, event));
}
