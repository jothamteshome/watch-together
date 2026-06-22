export async function createRoom() {
  const response = await fetch(`${import.meta.env.VITE_APP_BACKEND_URL}/v1/rooms/create-room`, {
    method: "POST",
  });
  const data = await response.json();
  return data.roomId;
}

export async function checkRoomExists(roomId: string): Promise<boolean> {
  const response = await fetch(`${import.meta.env.VITE_APP_BACKEND_URL}/v1/rooms/${roomId}`);
  return response.ok;
}
