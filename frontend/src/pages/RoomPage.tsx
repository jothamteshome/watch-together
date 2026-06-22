import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/room/Header";
import RoomNotFound from "../components/room/RoomNotFound";
import VideoPlayer from "../components/room/VideoPlayer";
import YoutubeVideo from "../components/youtube/YoutubeVideo";
import Playlist from "../components/playlist/Playlist";
import type ChatMessage from "../interfaces/ChatMessage";
import type BaseVideoInfo from "../interfaces/BaseVideoInfo";
import type YoutubeVideoInfo from "../interfaces/YoutubeVideoInfo";
import RoomManager from "../managers/RoomManager";
import { checkRoomExists } from "../services/room";


export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId;
  const roomManagerRef = useRef<RoomManager | null>(null);
  const [roomStatus, setRoomStatus] = useState<"loading" | "found" | "not-found">("loading");
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<BaseVideoInfo | undefined>();
  const [playlistVideos, setPlaylistVideos] = useState<string[]>([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(-1);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatNotifications, setChatNotifications] = useState<number>(0);

  const chatMessageLengthRef = useRef(0);

  useEffect(() => {
    setRoomStatus("loading");

    if (!roomId) {
      setRoomStatus("not-found");
      return;
    }

    let cancelled = false;

    const verifyRoom = async () => {
      try {
        const exists = await checkRoomExists(roomId);
        if (!cancelled) setRoomStatus(exists ? "found" : "not-found");
      } catch {
        if (!cancelled) setRoomStatus("not-found");
      }
    };

    verifyRoom();

    return () => { cancelled = true; };
  }, [roomId]);


  useEffect(() => {
    if (!roomId || roomStatus !== "found") return;

    const onVideoChanged = async () => {
      const info = await roomManagerRef.current?.fetchCurrentVideoInfo();
      setVideoInfo(info ?? undefined);
    };


    const updatePlaylistUI = (videos: string[], index: number) => {
      if (!roomId || !roomManagerRef.current) return;

      setPlaylistVideos(videos);
      setCurrentPlaylistIndex(index);
    };


    const updateChatUI = (messages: ChatMessage[]) => {
      if (!roomId || !roomManagerRef.current) return;

      const newNotifications: number = Math.max(messages.length - chatMessageLengthRef.current, 0);

      setChatMessages(messages);
      chatMessageLengthRef.current = messages.length;
      setChatNotifications(prev => prev + newNotifications);
    };

    roomManagerRef.current = new RoomManager(roomId, onVideoChanged, updatePlaylistUI, updateChatUI);

    return () => roomManagerRef.current?.destroy();
  }, [roomId, roomStatus]);


  const queueVideo = () => {
    if (!roomId || !roomManagerRef.current) return;

    roomManagerRef.current.queueVideo(url);
    setUrl("");
  };


  const selectPlaylistVideo = (index: number) => {
    if (!roomId || !roomManagerRef.current) return;
    roomManagerRef.current.selectPlaylistVideo(index);
  };


  const sendChatMessage = (msg: string) => {
    if (!roomId || !roomManagerRef.current) return;
    roomManagerRef.current.sendChatMessage(msg);
  };


  if (roomStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading room...</p>
      </div>
    );
  }

  if (roomStatus === "not-found" || !roomId) {
    return <RoomNotFound />;
  }

  return (
    <div className="w-full h-full flex flex-col items-center">
      <Header
        roomId={roomId}
        onSearchChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
        onSearchSubmit={queueVideo}
        chatMessages={chatMessages}
        chatNotifications={chatNotifications}
        clearChatNotifications={() => setChatNotifications(0)}
        sendChatMessage={sendChatMessage}
      />

      {/* Content area — left: video player + metadata, right: queue */}
      <div className="lg:w-[95%] w-full flex-1 p-4">
        <div className="w-full flex flex-col lg:flex-row lg:items-start gap-4">
          {/* Left column — containers are always in the DOM to support manager init */}
          <div className="w-full lg:flex-1 lg:min-w-0 flex flex-col gap-4">
            <VideoPlayer currentService={videoInfo?.serviceName} />

            {/* Service-specific video metadata */}
            {videoInfo?.serviceName === "youtube" && (
              <YoutubeVideo videoData={videoInfo as YoutubeVideoInfo} />
            )}
          </div>

          {/* Right column — queue */}
          <div className="lg:w-1/4 lg:max-w-140 lg:max-h-200 flex flex-col">
            <Playlist
              videos={playlistVideos}
              currentIndex={currentPlaylistIndex}
              onVideoSelect={selectPlaylistVideo}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


