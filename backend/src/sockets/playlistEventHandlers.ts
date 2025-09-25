import { Server, Socket } from "socket.io";
import type { PlaylistAddEvent, PlaylistNextEvent, PlaylistSelectEvent } from "../interfaces/PlaylistEvents.js";
import type { PlaylistState } from "../interfaces/States.js";
import { roomManager } from "../models/RoomManager.js";


export function handlePlaylistJoinRoomSync(socket: Socket, roomId: string) {
    // Send current playlist state to client
    const playlistState = roomManager.playlistStates.get(roomId);

    // If playlist state doesn't exist, return
    if (!playlistState) {
        console.log(`Playlist for room ${roomId} does not exist`);
        return;
    }

    // Sync client
    console.log("Playlist state: ", playlistState)
    socket.emit("playlist:sync", playlistState);
}


function handlePlaylistAdd(io: Server, { roomId, videoUrl, eventId }: PlaylistAddEvent) {
    const state: PlaylistState | undefined = roomManager.playlistStates.get(roomId);

    // If the room doesn't exist, return
    if (!state) {
        console.log(`Playlist for with id ${roomId} does not exist`);
        return;
    }

    // Ignore events if the eventId is less than or equal to what is known to the server
    if (state.eventId > eventId) return;

    // Update room's state on server
    state.eventId++;
    state.items.push(videoUrl);

    // If this current state is -1, set currentIndex to latest video in playlist
    if (state.currentIndex === -1) state.currentIndex = state.items.length - 1;


    console.log(`Broadcasting playlist:add in room ${roomId}`);
    console.log(state);
    io.to(roomId).emit("playlist:sync", state);
};


function handlePlaylistNext(io: Server, { roomId, eventId }: PlaylistNextEvent) {
    const state: PlaylistState | undefined = roomManager.playlistStates.get(roomId);

    // If the room doesn't exist, return
    if (!state) {
        console.log(`Playlist for with id ${roomId} does not exist`);
        return;
    }

    // Ignore events if the eventId is less than or equal to what is known to the server
    if (state.eventId > eventId) return;

    // Update room's state on server
    state.eventId++;

    // If current index is -1 (playlist ended) or going next will exceed playlist bounds, set index to -1
    // otherwise, increment the index
    if (state.currentIndex === -1) state.currentIndex = -1;
    else if (state.currentIndex >= state.items.length - 1) state.currentIndex = -1;
    else state.currentIndex++;
    

    console.log(`Broadcasting playlist:next in room ${roomId}`);
    console.log(state);
    io.to(roomId).emit("playlist:sync", state);
};


function handlePlaylistSelect(io: Server, { roomId, eventId, index }: PlaylistSelectEvent) {
    const state: PlaylistState | undefined = roomManager.playlistStates.get(roomId);

    // If the room doesn't exist, return
    if (!state) {
        console.log(`Playlist for with id ${roomId} does not exist`);
        return;
    }

    // Ignore events if the eventId is less than or equal to what is known to the server
    if (state.eventId > eventId) return;

    // Update room's state on server
    state.eventId++;
    state.currentIndex = index;

    console.log(`Broadcasting playlist:select in room ${roomId}`);
    console.log(state);
    io.to(roomId).emit("playlist:sync", state);
};


export function registerPlaylistEventHandlers(io: Server, socket: Socket) {
    // Playlist events
    socket.on("playlist:add", ({ roomId, eventId, videoUrl }: PlaylistAddEvent) => handlePlaylistAdd(io, { roomId, videoUrl, eventId }));
    socket.on("playlist:next", ({ roomId, eventId }: PlaylistNextEvent) => handlePlaylistNext(io, { roomId, eventId }));
    socket.on("playlist:select", ({ roomId, eventId, index }: PlaylistSelectEvent) => handlePlaylistSelect(io, { roomId, eventId, index }))
};