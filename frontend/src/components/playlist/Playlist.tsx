import PlaylistVideo from "./PlaylistVideo";

interface PlayistProps {
    videos: string[];
    currentIndex: number;
    onVideoSelect: (index: number) => void;
}

export default function Playist({ videos, currentIndex, onVideoSelect }: PlayistProps) {
    return (
        videos.length > 0 &&
        <div className="w-1/2 flex flex-col overflow-y-auto h-96 rounded-xl bg-neutral-800 mt-2 px-2 pb-2">
            {
                videos.map((videoUrl: string, i: number) =>
                (
                    <PlaylistVideo key={`${videoUrl}-${i}`} watching={i === currentIndex} videoUrl={videoUrl} index={i} onVideoSelect={onVideoSelect} />
                ))
            }
        </div>
    );
};