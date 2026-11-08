import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/room/Header";
import RoomNotFound from "../components/room/RoomNotFound";
import VideoPlayer from "../components/room/VideoPlayer";
import VideoMetadataPanel from "../components/video/VideoMetadataPanel";
import Playlist from "../components/playlist/Playlist";
import type ChatMessage from "@shared/interfaces/ChatMessage";
import type PlaylistItem from "@shared/interfaces/PlaylistItem";
import type User from "@shared/interfaces/User";
import type { UserUpdateEvent } from "@shared/interfaces/UserEvents";
import type { VideoInfo } from "@shared/interfaces/VideoInfo";
import type { VideoService } from "@shared/interfaces/VideoService";
import RoomManager from "../managers/RoomManager";
import { checkRoomExists } from "../services/room";


/** Keyed by the room id, so a different room starts with fresh state instead of resetting it by hand */
export default function RoomPage() {
  const { roomId } = useParams();
  return <Room key={roomId} roomId={roomId} />;
}


function Room({ roomId }: { roomId: string | undefined }) {
  const roomManagerRef = useRef<RoomManager | null>(null);
  const [roomStatus, setRoomStatus] = useState<"loading" | "found" | "not-found">(roomId ? "loading" : "not-found");
  const [url, setUrl] = useState("");
  const [currentService, setCurrentService] = useState<VideoService | undefined>();
  const [videoInfo, setVideoInfo] = useState<VideoInfo | undefined>();
  const [playlistVideos, setPlaylistVideos] = useState<PlaylistItem[]>([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(-1);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatNotifications, setChatNotifications] = useState<number>(0);
  const [selfUser, setSelfUser] = useState<User | undefined>();
  const [roomUsers, setRoomUsers] = useState<User[]>([]);

  const chatMessageLengthRef = useRef(0);
  // Tracked via ref, not state — read inside updateChatUI, which is captured once by the
  // effect below and never re-created, so a ref avoids it ever seeing a stale value.
  const isChatOpenRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;

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

    const onVideoChanged = async (service: VideoService) => {
      // The player depends on the service alone, so show it before the metadata arrives, or if it never does
      setCurrentService(service);
      const info = await roomManagerRef.current?.fetchCurrentVideoInfo();
      setVideoInfo(info ?? undefined);
    };


    const updatePlaylistUI = (videos: PlaylistItem[], index: number) => {
      if (!roomId || !roomManagerRef.current) return;

      setPlaylistVideos(videos);
      setCurrentPlaylistIndex(index);
    };


    const updateChatUI = (messages: ChatMessage[], isHistory: boolean) => {
      if (!roomId || !roomManagerRef.current) return;

      // Don't notify for messages this client sent itself, while chat is
      // open, or for chat history sync.
      const newMessages = messages.slice(chatMessageLengthRef.current);
      const newNotifications = isChatOpenRef.current || isHistory
        ? 0
        : newMessages.filter((m) => !m.systemEvent && m.user.id !== roomManagerRef.current?.selfUserId).length;

      setChatMessages(messages);
      chatMessageLengthRef.current = messages.length;
      setChatNotifications(prev => prev + newNotifications);
    };

    roomManagerRef.current = new RoomManager(roomId, onVideoChanged, updatePlaylistUI, updateChatUI, setSelfUser, setRoomUsers);

    return () => roomManagerRef.current?.destroy();
  }, [roomId, roomStatus]);


  const queueVideo = () => {
    if (!roomId || !roomManagerRef.current) return;

    roomManagerRef.current.queueVideo(url);
    setUrl("");
  };


  const selectPlaylistVideo = (index: number) => {
    const item = playlistVideos[index];
    if (!roomId || !roomManagerRef.current || !item) return;
    roomManagerRef.current.selectPlaylistVideo(item.id);
  };


  const sendChatMessage = (msg: string) => {
    if (!roomId || !roomManagerRef.current) return;
    roomManagerRef.current.sendChatMessage(msg);
  };


  const updateProfile = (changes: UserUpdateEvent) => {
    if (!roomId || !roomManagerRef.current) return;
    roomManagerRef.current.updateProfile(changes);
  };


  const fetchVideoInfo = useCallback(async (videoUrl: string) => {
    return (await roomManagerRef.current?.fetchVideoInfoForUrl(videoUrl)) ?? null;
  }, []);


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
        onChatOpenChange={(isOpen: boolean) => { isChatOpenRef.current = isOpen; }}
        user={selfUser}
        users={roomUsers}
        updateProfile={updateProfile}
      />

      {/* Content area — below lg: player, queue, metadata stacked in that order.
          At lg+: player + metadata form the left column, queue spans beside both as the right column. */}
      <div className="lg:w-[95%] w-full flex-1 p-4">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_clamp(16.25rem,25%,35rem)] gap-y-2 gap-x-4 lg:relative">
          {/* Video player — containers are always in the DOM to support manager init */}
          <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1 lg:min-w-0 w-full flex flex-col">
            <VideoPlayer currentService={currentService} />
          </div>

          {/* Queue */}
          <div className="order-2 lg:order-none lg:absolute lg:inset-y-0 lg:right-0 lg:w-[clamp(16.25rem,25%,35rem)] lg:max-h-200 max-h-100 flex flex-col">
            <Playlist
              videos={playlistVideos}
              currentIndex={currentPlaylistIndex}
              onVideoSelect={selectPlaylistVideo}
              fetchVideoInfo={fetchVideoInfo}
            />
          </div>

          {/* Video metadata */}
          {videoInfo && (
            <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2 lg:min-w-0 w-full flex flex-col gap-y-2 gap-x-4">
              <VideoMetadataPanel videoData={videoInfo} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


