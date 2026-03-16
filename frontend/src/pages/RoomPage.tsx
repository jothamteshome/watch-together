import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import SearchBar from "../components/room/SearchBar";
import RoomInfo from "../components/room/RoomInfo";
import VideoPlayer from "../components/room/VideoPlayer";
import YoutubeVideo from "../components/youtube/YoutubeVideo";
import type ChatMessage from "../interfaces/ChatMessage";
import type BaseVideoInfo from "../interfaces/BaseVideoInfo";
import type YoutubeVideoInfo from "../interfaces/YoutubeVideoInfo";
import RoomManager from "../managers/RoomManager";
import SidePanel from "../components/side-panel/SidePanel";


export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId!;
  const roomManagerRef = useRef<RoomManager | null>(null);
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<BaseVideoInfo | undefined>();
  const [playlistVideos, setPlaylistVideos] = useState<string[]>([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(-1);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showSidePanel, setShowSidePanel] = useState<boolean>(false);
  const [chatNotifications, setChatNotifications] = useState<number>(0);
  const [playlistNotifications, setPlaylistNotifications] = useState<number>(0);

  const chatMessageLengthRef = useRef(0);
  const playlistVideoLengthRef = useRef(0);

  useEffect(() => {
    if (!roomId) return;

    const onVideoChanged = async () => {
      const info = await roomManagerRef.current?.fetchCurrentVideoInfo();
      setVideoInfo(info ?? undefined);
    };


    const updatePlaylistUI = (videos: string[], index: number) => {
      if (!roomId || !roomManagerRef.current) return;

      const newNotifications: number = Math.max(videos.length - playlistVideoLengthRef.current, 0);

      setPlaylistVideos(videos);
      playlistVideoLengthRef.current = videos.length;
      setPlaylistNotifications(prev => prev + newNotifications);
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
  }, [roomId]);


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


  return (
    <div className="w-full h-full flex">
      {/* Main Content */}
      <div className="w-full h-full flex flex-col items-center">
        <RoomInfo roomId={roomId} />
        <SearchBar
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
          onClick={queueVideo}
        />

        {/* Video player — containers are always in the DOM to support manager init */}
        <div className="w-full flex flex-col items-center">
          <div className="w-4/5 max-w-7xl flex flex-col">
            <VideoPlayer currentService={videoInfo?.serviceName} />
          </div>

          {/* Service-specific video metadata */}
          {videoInfo?.serviceName === "youtube" && (
            <YoutubeVideo videoData={videoInfo as YoutubeVideoInfo} />
          )}
        </div>
      </div>

      <SidePanel
        videos={playlistVideos}
        currentPlaylistIndex={currentPlaylistIndex}
        selectPlaylistVideo={selectPlaylistVideo}
        chatMessages={chatMessages}
        chatNotifications={chatNotifications}
        playlistNotifications={playlistNotifications}
        clearChatNotifications={() => setChatNotifications(0)}
        clearPlaylistNotifications={() => setPlaylistNotifications(0)}
        sendChatMessage={sendChatMessage}
        showSidePanel={showSidePanel}
        setPanelVisibility={(panelVisible: boolean) => setShowSidePanel(panelVisible)}
      />
    </div>
  );
}


