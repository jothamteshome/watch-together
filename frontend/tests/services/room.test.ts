import { describe, expect, it } from "vitest";
import { checkRoomExists, createRoom } from "../../src/services/room";
import { BACKEND_URL, ROOM_ID, stubFetch } from "../support/helpers";


describe("createRoom", () => {
    it("POSTs to the create-room route and returns the new room id", async () => {
        // Arrange
        const fetchMock = stubFetch({ "/v1/rooms/create-room": { body: { roomId: ROOM_ID } } });

        // Act
        const roomId = await createRoom();

        // Assert
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${BACKEND_URL}/v1/rooms/create-room`, { method: "POST" });
        expect(roomId).toBe(ROOM_ID);
    });
});


describe("checkRoomExists", () => {
    it.each([
        { status: 200, exists: true },
        { status: 404, exists: false }
    ])("returns $exists when the room route answers $status", async ({ status, exists }) => {
        // Arrange
        const fetchMock = stubFetch({ [`/v1/rooms/${ROOM_ID}`]: { status } });

        // Act
        const result = await checkRoomExists(ROOM_ID);

        // Assert
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`${BACKEND_URL}/v1/rooms/${ROOM_ID}`);
        expect(result).toBe(exists);
    });
});
