import { useEffect, useRef } from "react";
import PlaylistVideo from "./PlaylistVideo";


interface PlayistProps {
    videos: string[];
    currentIndex: number;
    onVideoSelect: (index: number) => void;
    showPlaylist: boolean;
}


export default function Playist({ videos, currentIndex, onVideoSelect, showPlaylist }: PlayistProps) {
    const hidePlaylistStyle: string = videos.length > 0 && showPlaylist ? "flex" : "hidden";
    const currentVideoRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        currentVideoRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [videos]);

    return (
        <div className={`w-full h-full ${hidePlaylistStyle} flex-col overflow-y-auto overscroll-none rounded-xl`}>
            {
                videos.map((videoUrl: string, i: number) =>
                (
                    <PlaylistVideo ref={i === currentIndex ? currentVideoRef : null} key={`${videoUrl}-${i}`} watching={i === currentIndex} videoUrl={videoUrl} index={i} onVideoSelect={() => onVideoSelect(i)} />
                ))
            }
        </div>
    );
};