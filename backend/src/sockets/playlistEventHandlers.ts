import { nanoid } from "nanoid";
import { Server, Socket } from "socket.io";
import type { PlaylistAddEvent, PlaylistNextEvent, PlaylistSelectEvent } from "@shared/interfaces/PlaylistEvents";
import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type { PlaylistState } from "@shared/interfaces/States";
import type User from "@shared/interfaces/User";
import { serverManager } from "../models/RoomManager.js";
import { setVideoItem } from "./videoEventHandlers.js";


function handlePlaylistAdd(io: Server, socket: Socket, { roomId, eventId, videoUrl, videoService }: PlaylistAddEvent) {
    const playlistState: PlaylistState | null = serverManager.getPlaylistState(roomId);
    if (!playlistState) return;

    const addedBy: User | undefined = serverManager.getUserBySocket(socket.id);
    if (!addedBy) return;

    if (playlistState.eventId > eventId) return;

    const item: PlaylistItem = { id: nanoid(8), videoUrl, videoService, addedBy };
    playlistState.eventId++;
    playlistState.items.push(item);

    // Nothing is playing (empty or ended playlist): start the new item
    const startItem = playlistState.currentIndex === -1;
    if (startItem) playlistState.currentIndex = playlistState.items.length - 1;

    console.log(`Broadcasting playlist:add in room ${roomId}`);
    console.log(playlistState);
    io.to(roomId).emit("playlist:sync", playlistState);

    if (startItem) setVideoItem(io, roomId, item);
}


function handlePlaylistNext(io: Server, { roomId, itemId }: PlaylistNextEvent) {
    const playlistState: PlaylistState | null = serverManager.getPlaylistState(roomId);
    if (!playlistState) return;

    // Every client reports the end; only the first report for the current item counts
    if (playlistState.items[playlistState.currentIndex]?.id !== itemId) return;

    playlistState.eventId++;

    if (playlistState.currentIndex >= playlistState.items.length - 1) playlistState.currentIndex = -1;
    else playlistState.currentIndex++;

    console.log(`Broadcasting playlist:next in room ${roomId}`);
    console.log(playlistState);
    io.to(roomId).emit("playlist:sync", playlistState);

    const nextItem = playlistState.items[playlistState.currentIndex];
    if (nextItem) setVideoItem(io, roomId, nextItem);
}


function handlePlaylistSelect(io: Server, { roomId, eventId, index }: PlaylistSelectEvent) {
    const playlistState: PlaylistState | null = serverManager.getPlaylistState(roomId);
    if (!playlistState) return;

    if (playlistState.eventId > eventId) return;

    // Clicking the loaded item is a no-op. That includes the last item after the
    // playlist ended: a finished playlist stays on it, and the scrubber restarts it.
    const item = playlistState.items[index];
    if (!item || item.id === serverManager.getVideoState(roomId)?.itemId) return;

    playlistState.eventId++;
    playlistState.currentIndex = index;

    console.log(`Broadcasting playlist:select in room ${roomId}`);
    console.log(playlistState);
    io.to(roomId).emit("playlist:sync", playlistState);

    setVideoItem(io, roomId, item);
}


export function registerPlaylistEventHandlers(io: Server, socket: Socket) {
    socket.on("playlist:add", ({ roomId, eventId, videoUrl, videoService }: PlaylistAddEvent) => handlePlaylistAdd(io, socket, { roomId, videoUrl, videoService, eventId }));
    socket.on("playlist:next", ({ roomId, itemId }: PlaylistNextEvent) => handlePlaylistNext(io, { roomId, itemId }));
    socket.on("playlist:select", ({ roomId, eventId, index }: PlaylistSelectEvent) => handlePlaylistSelect(io, { roomId, eventId, index }));
};
