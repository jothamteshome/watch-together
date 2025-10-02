import { Server, Socket } from "socket.io";
import type { PlaylistAddEvent, PlaylistNextEvent, PlaylistSelectEvent } from "../interfaces/PlaylistEvents.js";
import type { PlaylistState } from "../interfaces/States.js";
import { serverManager } from "../models/RoomManager.js";
import type RoomState from "../interfaces/RoomState.js";


export function handlePlaylistJoinRoomSync(socket: Socket, roomId: string) {
    // If room state doesn't exist, return
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) {
        console.log(`Room state ${roomId} does not exist`);
        return;
    }


    // If playlist state doesn't exist, return
    const playlistState: PlaylistState | null = roomState.getPlaylistState();
    if (!playlistState) {
        console.log(`Playlist for room ${roomId} does not exist`);
        return;
    }

    // Sync client
    console.log("Playlist state: ", playlistState)
    socket.emit("playlist:sync", playlistState);
}


function handlePlaylistAdd(io: Server, { roomId, videoUrl, eventId }: PlaylistAddEvent) {
    // If room state doesn't exist, return
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) {
        console.log(`Room state ${roomId} does not exist`);
        return;
    }


    // If playlist state doesn't exist, return
    const playlistState: PlaylistState | null = roomState.getPlaylistState();
    if (!playlistState) {
        console.log(`Playlist for room ${roomId} does not exist`);
        return;
    }


    // Ignore events if the eventId is less than or equal to what is known to the server
    if (playlistState.eventId > eventId) return;

    // Update room's state on server
    playlistState.eventId++;
    playlistState.items.push(videoUrl);

    // If this current state is -1, set currentIndex to latest video in playlist
    if (playlistState.currentIndex === -1) {
        playlistState.currentIndex = playlistState.items.length - 1;
    }


    console.log(`Broadcasting playlist:add in room ${roomId}`);
    console.log(playlistState);
    io.to(roomId).emit("playlist:sync", playlistState);
};


function handlePlaylistNext(io: Server, { roomId, eventId }: PlaylistNextEvent) {
    // If room state doesn't exist, return
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) {
        console.log(`Room state ${roomId} does not exist`);
        return;
    }


    // If playlist state doesn't exist, return
    const playlistState: PlaylistState | null = roomState.getPlaylistState();
    if (!playlistState) {
        console.log(`Playlist for room ${roomId} does not exist`);
        return;
    }

    // Ignore events if the eventId is less than or equal to what is known to the server
    if (playlistState.eventId > eventId) return;

    // Update room's state on server
    playlistState.eventId++;

    // If current index is -1 (playlist ended) or going next will exceed playlist bounds, set index to -1
    // otherwise, increment the index
    if (playlistState.currentIndex === -1) playlistState.currentIndex = -1;
    else if (playlistState.currentIndex >= playlistState.items.length - 1) playlistState.currentIndex = -1;
    else playlistState.currentIndex++;
    

    console.log(`Broadcasting playlist:next in room ${roomId}`);
    console.log(playlistState);
    io.to(roomId).emit("playlist:sync", playlistState);
};


function handlePlaylistSelect(io: Server, { roomId, eventId, index }: PlaylistSelectEvent) {
    // If room state doesn't exist, return
    const roomState: RoomState | undefined = serverManager.serverRooms.get(roomId);
    if (!roomState) {
        console.log(`Room state ${roomId} does not exist`);
        return;
    }


    // If playlist state doesn't exist, return
    const playlistState: PlaylistState | null = roomState.getPlaylistState();
    if (!playlistState) {
        console.log(`Playlist for room ${roomId} does not exist`);
        return;
    }

    // Ignore events if the eventId is less than or equal to what is known to the server
    if (playlistState.eventId > eventId) return;

    // Update room's state on server
    playlistState.eventId++;
    playlistState.currentIndex = index;

    console.log(`Broadcasting playlist:select in room ${roomId}`);
    console.log(playlistState);
    io.to(roomId).emit("playlist:sync", playlistState);
};


export function registerPlaylistEventHandlers(io: Server, socket: Socket) {
    // Playlist events
    socket.on("playlist:add", ({ roomId, eventId, videoUrl }: PlaylistAddEvent) => handlePlaylistAdd(io, { roomId, videoUrl, eventId }));
    socket.on("playlist:next", ({ roomId, eventId }: PlaylistNextEvent) => handlePlaylistNext(io, { roomId, eventId }));
    socket.on("playlist:select", ({ roomId, eventId, index }: PlaylistSelectEvent) => handlePlaylistSelect(io, { roomId, eventId, index }))
};