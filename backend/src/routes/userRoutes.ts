import { Router } from "express";
import generateUser from "../utils/generateUser.js";
import type User from "@shared/interfaces/User.js";

const router = Router();

/** Route to generate a new random user for a new client */
router.get("/generate", (req, res) => {
  const user: User = generateUser();

  res.json(user);
});

export default router;
