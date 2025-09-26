import type { JSX } from "react";

interface SidePanelSelectorProps {
    className?: string;
    title: string;
    onClick: () => void;
    buttonSelected: boolean;
    children?: JSX.Element;
}

export default function SidePanelSelector({ className = "", title, onClick, buttonSelected, children }: SidePanelSelectorProps) {
    const selectedBackgroundStyle: string = buttonSelected ? "bg-neutral-700" : "bg-black";

    return (
        <div
            title={title}
            className={`w-[4rem] absolute -left-[4rem] aspect-square rounded-l-xl ${selectedBackgroundStyle} border-white border-[0.1rem] border-r-0 cursor-pointer p-4 ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
}