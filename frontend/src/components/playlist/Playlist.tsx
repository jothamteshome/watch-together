import { useState } from "react";
import PlaylistControls from "./PlaylistControls";
import PlaylistVideoList from "./PlaylistVideoList";
import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";


interface PlayistProps {
    videos: PlaylistItem[];
    currentIndex: number;
    onVideoSelect: (index: number) => void;
    fetchVideoInfo: (videoUrl: string) => Promise<VideoInfo | null>;
}


export default function Playist({ videos, currentIndex, onVideoSelect, fetchVideoInfo }: PlayistProps) {
    const [isOpen, setOpen] = useState<boolean>(true);

    const togglePlaylistOpenState = (): void => {
        setOpen(!isOpen);
    };

    return (
        <div className="w-full max-h-100 lg:max-h-200 flex flex-col rounded-lg overflow-hidden">
            <PlaylistControls isOpen={isOpen} isEmpty={videos.length === 0} onToggle={togglePlaylistOpenState}/>
            <div className={`flex-1 min-h-0 grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="min-h-0 overflow-hidden">
                    <PlaylistVideoList videos={videos} currentIndex={currentIndex} onVideoSelect={onVideoSelect} fetchVideoInfo={fetchVideoInfo} />
                </div>
            </div>
        </div>
    );
};