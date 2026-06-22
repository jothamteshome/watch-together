import { useEffect, useRef } from "react";
import { ListVideo } from "lucide-react";
import PlaylistVideo from "./PlaylistVideo";


interface PlayistProps {
    videos: string[];
    currentIndex: number;
    onVideoSelect: (index: number) => void;
}


export default function Playist({ videos, currentIndex, onVideoSelect }: PlayistProps) {
    const currentVideoRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        currentVideoRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [videos]);

    if (videos.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 rounded-xl bg-zinc-700">
                <ListVideo className="w-14 h-14 text-gray-500" strokeWidth={1.5} />
                <p className="text-gray-500 text-sm">Queue is empty</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col overflow-y-auto overscroll-none rounded-xl">
            {
                videos.map((videoUrl: string, i: number) =>
                (
                    <PlaylistVideo ref={i === currentIndex ? currentVideoRef : null} key={`${videoUrl}-${i}`} watching={i === currentIndex} videoUrl={videoUrl} index={i} onVideoSelect={() => onVideoSelect(i)} />
                ))
            }
        </div>
    );
};