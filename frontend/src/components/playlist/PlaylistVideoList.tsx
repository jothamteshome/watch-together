import { useEffect, useRef } from "react";
import PlaylistVideo from "./PlaylistVideo";
import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";

interface PlayistVideoListProps {
    videos: PlaylistItem[];
    currentIndex: number;
    onVideoSelect: (index: number) => void;
    fetchVideoInfo: (videoUrl: string) => Promise<VideoInfo | null>;
}

export default function PlaylistVideoList({ videos, currentIndex, onVideoSelect, fetchVideoInfo }: PlayistVideoListProps) {
    const currentVideoRef = useRef<HTMLDivElement | null>(null);


    useEffect(() => {
        currentVideoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [currentIndex]);

    return (
        <div className="w-full h-full flex flex-col overflow-y-auto overscroll-none rounded-b-lg">
            {
                videos.map((item: PlaylistItem, i: number) =>
                (
                    <PlaylistVideo ref={i === currentIndex ? currentVideoRef : null} key={item.id} watching={i === currentIndex} item={item} index={i} onVideoSelect={() => onVideoSelect(i)} fetchVideoInfo={fetchVideoInfo} />
                ))
            }
        </div>
    );
}