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
            {/* YouTube player container */}
            <div className={`aspect-video rounded-xl ${currentService === "youtube" ? "block" : "hidden"}`}>
                <div id="youtube-player" className="w-full h-full rounded-xl" />
            </div>
        </>
    );
}
