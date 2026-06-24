import { Router } from "express";
import { serverManager } from "../models/RoomManager.js";
import videoProviders from "../services/videoProviders/index.js";
import type { VideoService } from "@shared/interfaces/VideoService";


const router = Router();


function isSupportedService(service: string): service is VideoService {
    return service in videoProviders;
}


/** GET /:service/video/:id — returns normalized video metadata; `id` is opaque and service-defined */
router.get("/:service/video/:id", async (req, res) => {
    const { service, id } = req.params;

    if (!isSupportedService(service)) {
        res.status(400).json({ error: `Unsupported video service: ${service}` });
        return;
    }

    const cacheKey = `${service}:${id}`;

    if (serverManager.videoCache.has(cacheKey)) {
        res.json(serverManager.videoCache.get(cacheKey));
        return;
    }

    try {
        const videoInfo = await videoProviders[service].getVideoInfo(id);

        serverManager.videoCache.set(cacheKey, videoInfo);
        setTimeout(() => {
            serverManager.videoCache.delete(cacheKey);
        }, 1000 * 60 * 60);

        res.json(videoInfo);
    } catch {
        console.error(`Error retrieving data from ${service} provider`);
        res.status(500).json({ error: "Failed to fetch video data" });
    }
});


export default router;
