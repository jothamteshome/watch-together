import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import SearchBar from "../components/room/SearchBar";
import RoomInfo from "../components/room/RoomInfo";
import YoutubeVideo from "../components/youtube/YoutubeVideo";
import RoomManager from "../managers/RoomManager";
import type VideoData from "../models/VideoData";
import Playlist from "../components/playlist/Playlist";


export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId!;
  const roomManagerRef = useRef<RoomManager | null>(null);
  const [url, setUrl] = useState("");
  const [videoData, setVideoData] = useState<VideoData>();
  const [playlistVideos, setPlaylistVideos] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    if (!roomId) return;

    const onVideoChanged = async () => {
      const videoId = roomManagerRef.current?.getVideoId();
      if (!videoId) return;

      try {
        const response = await fetch(`${import.meta.env.VITE_APP_BACKEND_URL}/v1/youtube-api/video/${videoId}`);
        const data = await response.json();

        setVideoData(data);
      } catch {
        console.error(`Unable to retrieve data about video ${videoId}`);
      }
    };


    const onPlaylistUpdate = (videos: string[], index: number) => {
      if (!roomId || !roomManagerRef.current) return;

      setPlaylistVideos(videos);
      setCurrentIndex(index);
    };

    roomManagerRef.current = new RoomManager(roomId, onVideoChanged, onPlaylistUpdate);

    return () => roomManagerRef.current?.destroy();
  }, [roomId]);


  const queueVideo = () => {
    if (!roomId || !roomManagerRef.current) return;

    roomManagerRef.current.queueVideo(url);
    setUrl("");
  };


  const selectPlaylistVideo = (index: number) => {
    if (!roomId || !roomManagerRef.current) return;
    roomManagerRef.current.selectPlaylistVideo(index);
  }


  return (
    <div className="w-full h-full flex flex-col items-center">

      <RoomInfo roomId={roomId} />

      <SearchBar
        onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
        onClick={queueVideo}
      />

      <YoutubeVideo videoData={videoData} />

      <div className="w-4/5 max-w-7xl flex">
        <Playlist videos={playlistVideos} currentIndex={currentIndex} onVideoSelect={selectPlaylistVideo}/>
      </div>
      
    </div>
  );
}
