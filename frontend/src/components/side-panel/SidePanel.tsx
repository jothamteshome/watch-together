import { ListVideo, MessageSquareText, X } from "lucide-react";
import { useState } from "react";
import SidePanelSelector from "./SidePanelSelector";
import Chat from "../chat/Chat";
import Playlist from "../playlist/Playlist";
import type { SidePanelTypes } from "../../interfaces/SidePanelTypes";


interface SidePanelProps {
    showSidePanel: boolean;
    videos: string[];
    currentVideoIndex: number;
    selectPlaylistVideo: (index: number) => void;
    setPanelVisibility: (panelVisibility: boolean) => void;
}


export default function SidePanel({ videos, currentVideoIndex, selectPlaylistVideo, showSidePanel, setPanelVisibility }: SidePanelProps) {
    const [panelType, setPanelType] = useState<SidePanelTypes>("video");

    const showSidePanelStyle = showSidePanel ? "right-0" : "-right-[28rem]";

    const handleSelectorClick = (setType: SidePanelTypes) => {
        setPanelType(setType);
        setPanelVisibility(true);
    }

    return (
        <div className={`w-md h-full fixed top-0 ${showSidePanelStyle} flex flex-col bg-black outline-white outline-[0.1rem] rounded-l-xl py-2 my-1 pl-2 duration-500`}>
            {/** Close panel button */}
            <X className="self-end mr-2 cursor-pointer" onClick={() => setPanelVisibility(false)} />

            {/** Panel displays */}
            <Playlist videos={videos} currentIndex={currentVideoIndex} onVideoSelect={selectPlaylistVideo} showPlaylist={panelType === "video"} />
            <Chat showChat={panelType === "chat"} />

            {/** Panel selectors */}
            <SidePanelSelector className={"bottom-[8.25rem]"} title={"Open Playlist"}  onClick={() => handleSelectorClick("video")} buttonSelected={panelType === "video" && showSidePanel}>
                <ListVideo className="w-full h-full" />
            </SidePanelSelector>
            <SidePanelSelector className={"bottom-[4rem]"} title={"Open Chat"}  onClick={() => handleSelectorClick("chat")} buttonSelected={panelType === "chat" && showSidePanel}>
                <MessageSquareText className="w-full h-full" />
            </SidePanelSelector>
        </div>
    );
}