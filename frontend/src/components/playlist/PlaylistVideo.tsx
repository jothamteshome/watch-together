import { useEffect, useState } from "react";
import extractVideoId from "../../utils/extractVideoId";


interface PlaylistVideoProps {
    videoUrl: string;
    watching: boolean;
    index: number;
    onVideoSelect: (index: number) => void;
};


interface PlaylistVideoData {
    videoTitle: string;
    channelTitle: string;
    videoThumbnail: string;
}


function PlaylistVideoThumbnail({ thumbnail }: { thumbnail: string }) {
    return (
        <div className="aspect-video flex-shrink-0">
            <img className="w-full h-full object-cover rounded-md" src={thumbnail} />
        </div>
    );
}

function PlaylistVideoInfo({ videoTitle, channelTitle }: { videoTitle: string; channelTitle: string }) {
    return (
        <div className="flex flex-col ml-2">
            <h1 className="text-sm line-clamp-1 mt-1" title={videoTitle}>{videoTitle}</h1>
            <h2 className="text-xs text-neutral-400">{channelTitle}</h2>
        </div>
    );
};


export default function PlaylistVideo({ videoUrl, watching, index, onVideoSelect }: PlaylistVideoProps) {
    const backgroundClass = watching ? "bg-neutral-700" : "bg-neutral-800";
    const [videoData, setVideoData] = useState<PlaylistVideoData>({ videoTitle: "", channelTitle: "", videoThumbnail: "" });

    useEffect(() => {
        const getVideoData = async () => {
            const { videoId } = extractVideoId(videoUrl);
            if (!videoId) return;

            const response = await fetch(`${import.meta.env.VITE_APP_BACKEND_URL}/v1/youtube-api/video/${videoId}`);
            const data = await response.json();

            setVideoData({ videoTitle: data.videoTitle, channelTitle: data.channelTitle, videoThumbnail: data.videoThumbnail });
        }

        getVideoData();
    }, [videoUrl]);

    return (
        <div className={`flex w-full h-20 rounded-xl mt-2 cursor-pointer ${backgroundClass}`} onClick={() => onVideoSelect(index)}>
            <p className="w-6 flex items-center justify-center text-xs">{index}</p>
            <PlaylistVideoThumbnail thumbnail={videoData.videoThumbnail} />
            <PlaylistVideoInfo videoTitle={videoData.videoTitle} channelTitle={videoData.channelTitle} />
        </div>
    );
};