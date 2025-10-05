import type { JSX } from "react";

interface SidePanelSelectorProps {
    className?: string;
    title: string;
    notifications: number;
    onClick: () => void;
    buttonSelected: boolean;
    children?: JSX.Element;
}

export default function SidePanelSelector({ className = "", title, notifications, onClick, buttonSelected, children }: SidePanelSelectorProps) {
    const selectedBackgroundStyle: string = buttonSelected ? "bg-neutral-700" : "bg-black";

    return (
        <div
            title={title}
            className={`w-[4rem] absolute -left-[4rem] aspect-square rounded-l-xl ${selectedBackgroundStyle} border-white border-[0.1rem] border-r-0 cursor-pointer p-4 ${className}`}
            onClick={onClick}
        >
            { notifications > 0 && <div className="min-w-5 h-5 p-1 flex justify-center items-center -top-[0.25rem] -left-[0.5rem] absolute rounded-full bg-red-500 text-xs">{notifications}</div> }
            {children}
        </div>
    );
}