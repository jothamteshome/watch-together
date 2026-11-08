import { useRef, useState } from "react";
import { Users } from "lucide-react";
import UserIcon from "./UserIcon";
import useClickOutside from "../../hooks/useClickOutside";
import type User from "@shared/interfaces/User";


interface OnlineUsersButtonProps {
    users: User[];
    selfUserId?: string | undefined;
}


/**
 * Shows how many users are in the room; clicking it opens a dropdown listing them.
 */
export default function OnlineUsersButton({ users, selfUserId }: OnlineUsersButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useClickOutside(containerRef, () => setIsOpen(false), isOpen);

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                title="Online Users"
                onClick={() => setIsOpen((prev) => !prev)}
                className={`flex items-center gap-1 p-2 rounded-full hover:bg-gray-100/10 cursor-pointer ${isOpen ? "bg-gray-100/10" : ""}`}
            >
                <Users className="w-5 h-5 stroke-neutral-500" />
                {/* Hidden until the room snapshot arrives, so it doesn't flash 0 */}
                {users.length > 0 && <span className="text-sm text-neutral-400">{users.length}</span>}
            </button>

            {isOpen && (
                <div className="fixed inset-x-4 top-20 mx-auto max-w-96 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:mx-0 sm:max-w-none sm:w-64 max-h-80 overflow-y-auto bg-neutral-900 border-white/40 border-1 rounded-lg p-2 shadow-lg z-10">
                    <ul className="flex flex-col gap-1">
                        {users.map((user) => (
                            <li key={user.id} className="flex items-center gap-2 p-1">
                                {/* Everyone listed is in the room, so the ring is always green (same meaning as in chat) */}
                                <div className="w-7 shrink-0 rounded-full border-2 border-green-500">
                                    <UserIcon src={user.icon} />
                                </div>
                                <p className="text-sm text-white break-all">
                                    {user.username}
                                    {user.id === selfUserId && <span className="text-neutral-400"> (you)</span>}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
