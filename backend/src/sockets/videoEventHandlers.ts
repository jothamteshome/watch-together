import type { Server, Socket } from "socket.io";
import type { VideoUpdateEvent } from "@shared/interfaces/VideoEvents";
import { serverManager } from "../models/RoomManager.js";
import type RoomState from "../models/RoomState.js";
import { isMember } from "./isMember.js";
import { logger } from "../utils/logger.js";


/** The fields come from the client, so check their types: a bad `time` would be stored and handed to every later joiner */
function isVideoUpdateEvent(event: unknown): event is VideoUpdateEvent {
    const { time, playbackRate, eventId } = event as Record<string, unknown>;
    return typeof time === "number" && Number.isFinite(time) && time >= 0
        && typeof playbackRate === "number" && Number.isFinite(playbackRate) && playbackRate > 0
        && typeof eventId === "number" && Number.isFinite(eventId);
}


/** Registers a handler for a video event, dropping the event unless its fields are valid */
function onVideoEvent(socket: Socket, name: string, handle: (event: VideoUpdateEvent) => void) {
    socket.on(name, (event: unknown) => {
        if (!isVideoUpdateEvent(event)) {
            logger.warn({ socketId: socket.id, event: name }, "Dropped video event with invalid fields");
            return;
        }
        handle(event);
    });
}


/**
 * Handle video play events from socket.IO
 * @param io                        The server instance handling events
 * @param socket                    The sender, who must be a member of the room
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.time           The timestamp to set the video to
 * @param videoEvent.playbackRate   The playback rate of the video
 * @param videoEvent.eventId        The eventId of the video event
 */
function handlePlayVideo(io: Server, socket: Socket, { roomId, time, playbackRate, eventId }: VideoUpdateEvent) {
    if (!isMember(socket, roomId)) return;

    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState?.updateVideo(eventId, time, playbackRate, true)) return;

    logger.debug({ roomId, time }, "Broadcasting video:play");
    io.to(roomId).emit("video:sync", roomState.getVideoState());
}


/**
 * Handle video pause events from socket.IO
 * @param io                        The server instance handling events
 * @param socket                    The sender, who must be a member of the room
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.time           The timestamp to set the video to
 * @param videoEvent.playbackRate   The playback rate of the video
 * @param videoEvent.eventId        The eventId of the video event
 */
function handlePauseVideo(io: Server, socket: Socket, { roomId, time, playbackRate, eventId }: VideoUpdateEvent) {
    if (!isMember(socket, roomId)) return;

    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState?.updateVideo(eventId, time, playbackRate, false)) return;

    logger.debug({ roomId, time }, "Broadcasting video:pause");
    io.to(roomId).emit("video:sync", roomState.getVideoState());
}


/**
 * Handle general video update events from socket.IO
 * @param io                        The server instance handling events
 * @param socket                    The sender, who must be a member of the room
 * @param videoEvent.roomId         The current roomId to handle events for
 * @param videoEvent.time           The timestamp to set the video to
 * @param videoEvent.playbackRate   The playback rate of the video
 * @param videoEvent.eventId        The eventId of the video event
 */
function handleUpdateVideo(io: Server, socket: Socket, { roomId, time, playbackRate, eventId }: VideoUpdateEvent) {
    if (!isMember(socket, roomId)) return;

    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState?.updateVideo(eventId, time, playbackRate)) return;

    logger.debug({ roomId, time }, "Broadcasting video:update");
    io.to(roomId).emit("video:sync", roomState.getVideoState());
}


export function registerVideoEventHandlers(io: Server, socket: Socket) {
    onVideoEvent(socket, "video:play", event => handlePlayVideo(io, socket, event));
    onVideoEvent(socket, "video:pause", event => handlePauseVideo(io, socket, event));
    onVideoEvent(socket, "video:seek", event => handleUpdateVideo(io, socket, event));
    onVideoEvent(socket, "video:playbackrate", event => handleUpdateVideo(io, socket, event));
}
