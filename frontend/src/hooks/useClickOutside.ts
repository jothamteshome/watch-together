import { useEffect } from "react";

export default function useClickOutside<T extends HTMLElement>(
    ref: React.RefObject<T | null>,
    onClickOutside: () => void,
    active: boolean = true
) {
    useEffect(() => {
        if (!active) return;

        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClickOutside();
            }
        };

        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [ref, onClickOutside, active]);
}
