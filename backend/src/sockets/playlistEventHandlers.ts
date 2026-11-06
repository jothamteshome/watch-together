import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import type { PlaylistAddEvent, PlaylistNextEvent, PlaylistSelectEvent } from "@shared/interfaces/PlaylistEvents";
import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type User from "@shared/interfaces/User";
import { serverManager } from "../models/RoomManager.js";
import type RoomState from "../models/RoomState.js";
import type { PlaylistChange } from "../models/RoomState.js";
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


function handlePlaylistAdd(io: Server, socket: Socket, { roomId, eventId, videoUrl, videoService }: PlaylistAddEvent) {
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) return;

    const addedBy: User | undefined = serverManager.getUserBySocket(socket.id);
    if (!addedBy) return;

    const item: PlaylistItem = { id: nanoid(8), videoUrl, videoService, addedBy };
    const change = roomState.addPlaylistItem(eventId, item);
    if (change) broadcastPlaylistChange(io, roomId, roomState, change, "add");
}


function handlePlaylistNext(io: Server, { roomId, itemId }: PlaylistNextEvent) {
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) return;

    const change = roomState.advancePlaylist(itemId);
    if (change) broadcastPlaylistChange(io, roomId, roomState, change, "next");
}


function handlePlaylistSelect(io: Server, { roomId, eventId, index }: PlaylistSelectEvent) {
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) return;

    const change = roomState.selectPlaylistItem(eventId, index);
    if (change) broadcastPlaylistChange(io, roomId, roomState, change, "select");
}


export function registerPlaylistEventHandlers(io: Server, socket: Socket) {
    socket.on("playlist:add", ({ roomId, eventId, videoUrl, videoService }: PlaylistAddEvent) => handlePlaylistAdd(io, socket, { roomId, videoUrl, videoService, eventId }));
    socket.on("playlist:next", ({ roomId, itemId }: PlaylistNextEvent) => handlePlaylistNext(io, { roomId, itemId }));
    socket.on("playlist:select", ({ roomId, eventId, index }: PlaylistSelectEvent) => handlePlaylistSelect(io, { roomId, eventId, index }));
};
