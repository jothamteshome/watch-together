import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";


interface PlaylistVideoProps {
    videoUrl: string;
    watching: boolean;
    index: number;
    ref: React.RefObject<HTMLDivElement | null> | null;
    onVideoSelect: () => void;
    fetchVideoInfo: (videoUrl: string) => Promise<VideoInfo | null>;
};


interface PlaylistVideoData {
    title?: string;
    channelName?: string;
    thumbnail?: string;
}


function PlaylistVideoThumbnail({ thumbnail }: { thumbnail?: string }) {
    return (
        <div className="aspect-video flex-shrink-0">
            <img className="aspect-video h-full object-cover rounded-lg" src={thumbnail || undefined} />
        </div>
    );
}

function PlaylistVideoInfo({ title, channelName, fallback }: { title?: string; channelName?: string; fallback: string }) {
    return (
        <div className="flex flex-col ml-2">
            <h1 className="text-sm line-clamp-1 mt-1" title={title ?? fallback}>{title ?? fallback}</h1>
            {channelName && <h2 className="text-xs text-neutral-400">{channelName}</h2>}
        </div>
    );
};


export default function PlaylistVideo({ videoUrl, watching, index, onVideoSelect, ref, fetchVideoInfo }: PlaylistVideoProps) {
    const backgroundClass = watching ? "bg-neutral-700" : "bg-neutral-900 hover:bg-neutral-700/70";
    const [videoData, setVideoData] = useState<PlaylistVideoData>({});

    useEffect(() => {
        const getVideoData = async () => {
            const info = await fetchVideoInfo(videoUrl);
            if (!info) return;

            setVideoData({ title: info.title, channelName: info.channel?.name, thumbnail: info.thumbnail });
        }

        getVideoData();
    }, [videoUrl, fetchVideoInfo]);

    return (
        <div ref={ref} className={`flex w-full h-20 py-2 cursor-pointer ${backgroundClass}`} onClick={onVideoSelect}>
            {
                watching ?
                <div className="min-w-6 flex items-center justify-center">
                    <Play  className="fill-gray-200 stroke-gray-200 stroke-1 w-3"/>
                </div> :
                <p className="min-w-6 flex items-center justify-center text-xs">{index + 1}</p>
            }
            <PlaylistVideoThumbnail thumbnail={videoData.thumbnail} />
            <PlaylistVideoInfo title={videoData.title} channelName={videoData.channelName} fallback={videoUrl} />
        </div>
    );
};