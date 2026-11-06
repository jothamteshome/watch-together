import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { describe, expect, it } from "vitest";
import JoinRoom from "../../src/components/home/JoinRoom";
import { ROOM_ID, stubFetch, type Route as FetchRoute } from "../support/helpers";


function RoomStub() {
    const { roomId } = useParams();
    return <p>{`In room ${roomId}`}</p>;
}


function renderHome() {
    render(
        <MemoryRouter initialEntries={["/"]}>
            <Routes>
                <Route path="/" element={<JoinRoom />} />
                <Route path="/room/:roomId" element={<RoomStub />} />
            </Routes>
        </MemoryRouter>
    );
}


describe("JoinRoom", () => {
    it("navigates to a room that exists", async () => {
        // Arrange
        stubFetch({ [`/v1/rooms/${ROOM_ID}`]: { status: 200 } });
        renderHome();
        const user = userEvent.setup();

        // Act
        await user.type(screen.getByPlaceholderText("Enter Room ID"), `${ROOM_ID}{Enter}`);

        // Assert
        expect(await screen.findByText(`In room ${ROOM_ID}`)).toBeTruthy();
    });

    it.each<{ case: string; typed: string; route?: FetchRoute }>([
        { case: "no room id is entered", typed: "" },
        { case: "the room doesn't exist", typed: ROOM_ID, route: { status: 404 } },
        { case: "the check fails", typed: ROOM_ID, route: new Error("network down") }
    ])("stays home and marks the input invalid when $case", async ({ typed, route }) => {
        // Arrange
        stubFetch(route ? { [`/v1/rooms/${ROOM_ID}`]: route } : {});
        renderHome();
        const user = userEvent.setup();
        const input = screen.getByPlaceholderText("Enter Room ID");
        if (typed) await user.type(input, typed);

        // Act
        await user.click(screen.getByRole("button", { name: "Join" }));

        // Assert
        await waitFor(() => expect(input.className).toContain("outline-red-600"));
        expect(screen.queryByText(/^In room/)).toBeNull();
    });
});
