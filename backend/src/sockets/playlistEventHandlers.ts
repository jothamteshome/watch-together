import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import type { PlaylistAddEvent, PlaylistNextEvent, PlaylistSelectEvent } from "@shared/interfaces/PlaylistEvents";
import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type User from "@shared/interfaces/User";
import { serverManager } from "../models/RoomManager.js";
import type RoomState from "../models/RoomState.js";
import type { PlaylistChange } from "../models/RoomState.js";
import { isSupportedService } from "../services/videoProviders/index.js";
import { isMember } from "./isMember.js";
import { logger } from "../utils/logger.js";


/** Broadcasts an accepted playlist change, and the video it started, if any */
function broadcastPlaylistChange(io: Server, roomId: string, roomState: RoomState, change: PlaylistChange, action: string) {
    const playlistState = roomState.getPlaylistState();
    logger.debug({ roomId, items: playlistState.items.length, currentIndex: playlistState.currentIndex }, `Broadcasting playlist:${action}`);
    io.to(roomId).emit("playlist:sync", playlistState);

    if (change !== "started") return;

    const videoState = roomState.getVideoState();
    logger.debug({ roomId, itemId: videoState.itemId, videoService: videoState.videoService }, "Setting video");
    io.to(roomId).emit("video:sync", videoState);
}


function handlePlaylistAdd(io: Server, socket: Socket, { roomId, videoUrl, videoService }: PlaylistAddEvent) {
    // The fields come from the client, and every member's player loads the item, so check them
    if (typeof videoUrl !== "string" || videoUrl === "" || typeof videoService !== "string" || !isSupportedService(videoService)) {
        logger.warn({ socketId: socket.id, event: "playlist:add" }, "Dropped playlist event with invalid fields");
        return;
    }

    if (!isMember(socket, roomId)) return;

    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) return;

    const addedBy: User | undefined = serverManager.getUserBySocket(socket.id);
    if (!addedBy) return;

    const item: PlaylistItem = { id: nanoid(8), videoUrl, videoService, addedBy };
    broadcastPlaylistChange(io, roomId, roomState, roomState.addPlaylistItem(item), "add");
}


function handlePlaylistNext(io: Server, socket: Socket, { roomId, itemId }: PlaylistNextEvent) {
    if (!isMember(socket, roomId)) return;

    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) return;

    const change = roomState.advancePlaylist(itemId);
    if (change) broadcastPlaylistChange(io, roomId, roomState, change, "next");
}


function handlePlaylistSelect(io: Server, socket: Socket, { roomId, itemId }: PlaylistSelectEvent) {
    if (!isMember(socket, roomId)) return;

    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) return;

    const change = roomState.selectPlaylistItem(itemId);
    if (change) broadcastPlaylistChange(io, roomId, roomState, change, "select");
}


export function registerPlaylistEventHandlers(io: Server, socket: Socket) {
    socket.on("playlist:add", ({ roomId, videoUrl, videoService }: PlaylistAddEvent) => handlePlaylistAdd(io, socket, { roomId, videoUrl, videoService }));
    socket.on("playlist:next", ({ roomId, itemId }: PlaylistNextEvent) => handlePlaylistNext(io, socket, { roomId, itemId }));
    socket.on("playlist:select", ({ roomId, itemId }: PlaylistSelectEvent) => handlePlaylistSelect(io, socket, { roomId, itemId }));
};
