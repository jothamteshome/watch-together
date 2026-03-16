import { VideoOff } from "lucide-react";
import type { VideoService } from "../../interfaces/VideoService";


interface VideoPlayerProps {
    currentService?: VideoService;
}


/**
 * Renders all service player containers.
 *
 * All containers are always present in the DOM so that each manager's initPlayer()
 * can find its element regardless of whether a video is currently active.
 * Visibility is toggled via Tailwind classes based on the active service.
 *
 * To add a new service: render its player container here alongside the YouTube one.
 */
export default function VideoPlayer({ currentService }: VideoPlayerProps) {
    return (
        <>
            {/* Placeholder shown when no video is active */}
            {!currentService && (
                <div className="aspect-video rounded-xl bg-zinc-700 flex flex-col items-center justify-center gap-3">
                    <VideoOff className="w-14 h-14 text-gray-500" strokeWidth={1.5} />
                    <p className="text-gray-500 text-sm">No video playing</p>
                </div>
            )}

            {/* YouTube player container */}
            <div className={`aspect-video rounded-xl ${currentService === "youtube" ? "block" : "hidden"}`}>
                <div id="youtube-player" className="w-full h-full rounded-xl" />
            </div>
        </>
    );
}
