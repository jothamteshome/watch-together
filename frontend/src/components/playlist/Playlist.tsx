import { useState, useRef, useEffect } from "react";
import PlaylistControls from "./PlaylistControls";
import PlaylistVideoList from "./PlaylistVideoList";


interface PlayistProps {
    videos: string[];
    currentIndex: number;
    onVideoSelect: (index: number) => void;
}


export default function Playist({ videos, currentIndex, onVideoSelect }: PlayistProps) {
    const [isOpen, setOpen] = useState<boolean>(true);
    const isEmpty = useRef(true);

    const togglePlaylistOpenState = (): void => {
        setOpen(!isOpen);
    };

    useEffect(() => {
        isEmpty.current = videos.length == 0;
    }, [videos])

    return (
        <div className="w-full h-full flex flex-col rounded-lg overflow-hidden">
            <PlaylistControls isOpen={isOpen} isEmpty={isEmpty.current} onToggle={togglePlaylistOpenState}/>
            <div className={`flex-1 min-h-0 grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="h-full min-h-0 overflow-hidden">
                    <PlaylistVideoList videos={videos} currentIndex={currentIndex} onVideoSelect={onVideoSelect} />
                </div>
            </div>
        </div>
    );
};