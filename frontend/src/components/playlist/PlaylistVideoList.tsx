import { useEffect, useRef } from "react";
import PlaylistVideo from "./PlaylistVideo";

interface PlayistVideoListProps {
    videos: string[];
    currentIndex: number;
    onVideoSelect: (index: number) => void;
}

export default function PlaylistVideoList({ videos, currentIndex, onVideoSelect }: PlayistVideoListProps) {
    const currentVideoRef = useRef<HTMLDivElement | null>(null);
    

    useEffect(() => {
        currentVideoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [currentIndex]);
    
    return (
        <div className="w-full flex flex-col overflow-y-auto overscroll-none rounded-b-lg">
            {
                videos.map((videoUrl: string, i: number) =>
                (
                    <PlaylistVideo ref={i === currentIndex ? currentVideoRef : null} key={`${videoUrl}-${i}`} watching={i === currentIndex} videoUrl={videoUrl} index={i} onVideoSelect={() => onVideoSelect(i)} />
                ))
            }
        </div>
    );
}