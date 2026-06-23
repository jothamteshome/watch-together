import { ChevronDown } from "lucide-react"

interface PlaylistControlsProps {
    isOpen: boolean;
    isEmpty: boolean;
    onToggle: () => void;
}

export default function PlaylistControls({ isOpen, isEmpty, onToggle }: PlaylistControlsProps) {
    return (
        <div className={`w-full min-h-12 flex justify-between rounded-t-lg transition-[border-radius] ${!isOpen || isEmpty ? "delay-250 rounded-b-lg" : "rounded-b-none"} p-4 bg-neutral-800`}>
            <h1 className="font-bold color-white">Playlist</h1>
            <ChevronDown
                className={`transition-transform duration-300 ${isOpen ? "" : "-rotate-180"}`}
                onClick={onToggle}
            />
        </div>
    )
}