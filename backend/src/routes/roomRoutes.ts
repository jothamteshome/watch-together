import { Router } from "express";
import { nanoid } from "nanoid";
import { serverManager } from "../models/RoomManager.js";
import getFormattedDate from "../utils/date.js";

const router = Router();

/** Route to create a new room on the server  */
router.post("/create-room", (req, res) => {
  console.log(`[${getFormattedDate()}] creating room`);
  const roomId = nanoid(8);

  serverManager.createRoom(roomId);

  res.json({ roomId });
});


/** Route to get a room on the server  */
router.get("/:roomId", (req, res) => {
  const { roomId } = req.params;

  if (serverManager.serverRooms.has(roomId)) {
    res.status(200).json(serverManager.serverRooms.get(roomId)?.getVideoState());
  } else {
    res.status(404).json({ error: "Room not found" });
  }

});

export default router;
