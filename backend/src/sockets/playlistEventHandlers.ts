import { Server, Socket } from "socket.io";
import type { PlaylistAddEvent, PlaylistNextEvent, PlaylistSelectEvent } from "../interfaces/PlaylistEvents.js";
import type { PlaylistState } from "../interfaces/States.js";
import { serverManager } from "../models/RoomManager.js";


export function handlePlaylistJoinRoomSync(socket: Socket, roomId: string) {
    const playlistState: PlaylistState | null = serverManager.getPlaylistState(roomId);
    if (!playlistState) return;

    console.log("Playlist state: ", playlistState);
    socket.emit("playlist:sync", playlistState);
}


function handlePlaylistAdd(io: Server, { roomId, videoUrl, eventId }: PlaylistAddEvent) {
    const playlistState: PlaylistState | null = serverManager.getPlaylistState(roomId);
    if (!playlistState) return;

    if (playlistState.eventId > eventId) return;

    playlistState.eventId++;
    playlistState.items.push(videoUrl);

    if (playlistState.currentIndex === -1) {
        playlistState.currentIndex = playlistState.items.length - 1;
    }

    console.log(`Broadcasting playlist:add in room ${roomId}`);
    console.log(playlistState);
    io.to(roomId).emit("playlist:sync", playlistState);
}


function handlePlaylistNext(io: Server, { roomId, eventId }: PlaylistNextEvent) {
    const playlistState: PlaylistState | null = serverManager.getPlaylistState(roomId);
    if (!playlistState) return;

    if (playlistState.eventId > eventId) return;

    playlistState.eventId++;

    if (playlistState.currentIndex === -1) playlistState.currentIndex = -1;
    else if (playlistState.currentIndex >= playlistState.items.length - 1) playlistState.currentIndex = -1;
    else playlistState.currentIndex++;

    console.log(`Broadcasting playlist:next in room ${roomId}`);
    console.log(playlistState);
    io.to(roomId).emit("playlist:sync", playlistState);
}


function handlePlaylistSelect(io: Server, { roomId, eventId, index }: PlaylistSelectEvent) {
    const playlistState: PlaylistState | null = serverManager.getPlaylistState(roomId);
    if (!playlistState) return;

    if (playlistState.eventId > eventId) return;

    playlistState.eventId++;
    playlistState.currentIndex = index;

    console.log(`Broadcasting playlist:select in room ${roomId}`);
    console.log(playlistState);
    io.to(roomId).emit("playlist:sync", playlistState);
}


export function registerPlaylistEventHandlers(io: Server, socket: Socket) {
    socket.on("playlist:add", ({ roomId, eventId, videoUrl }: PlaylistAddEvent) => handlePlaylistAdd(io, { roomId, videoUrl, eventId }));
    socket.on("playlist:next", ({ roomId, eventId }: PlaylistNextEvent) => handlePlaylistNext(io, { roomId, eventId }));
    socket.on("playlist:select", ({ roomId, eventId, index }: PlaylistSelectEvent) => handlePlaylistSelect(io, { roomId, eventId, index }));
};
