import { useRef, useState, type SubmitEvent } from "react";
import UserIcon from "./UserIcon";
import useClickOutside from "../../hooks/useClickOutside";
import { renameChanges } from "../../utils/identity";
import type User from "@shared/interfaces/User";
import type { UserUpdateEvent } from "@shared/interfaces/UserEvents";


// Keep in sync with MAX_USERNAME_LENGTH in backend/src/sockets/userEventHandlers.ts
const MAX_USERNAME_LENGTH = 40;


interface UserMenuProps {
    user: User;
    onUpdate: (changes: UserUpdateEvent) => void;
}


/**
 * Shows the current user's icon; clicking it opens a dropdown to edit their profile.
 */
export default function UserMenu({ user, onUpdate }: UserMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [draftName, setDraftName] = useState(user.username);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useClickOutside(containerRef, () => setIsOpen(false), isOpen);

    const toggleOpen = () => {
        if (!isOpen) setDraftName(user.username);
        setIsOpen((prev) => !prev);
    };

    const trimmedName = draftName.trim();
    const canSave = trimmedName !== "" && trimmedName !== user.username;

    const handleSubmit = (e: SubmitEvent) => {
        e.preventDefault();
        if (!canSave) return;

        onUpdate(renameChanges(user, trimmedName));
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                title="Edit Profile"
                onClick={toggleOpen}
                className={`p-1 rounded-full hover:bg-gray-100/10 cursor-pointer ${isOpen ? "bg-gray-100/10" : ""}`}
            >
                <div className="w-8 rounded-full border-2 border-white">
                    <UserIcon src={user.icon} />
                </div>
            </button>

            {isOpen && (
                <form
                    onSubmit={handleSubmit}
                    className="fixed inset-x-4 top-20 mx-auto max-w-96 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:mx-0 sm:max-w-none sm:w-72 flex flex-col gap-3 bg-neutral-900 border-white/40 border-1 rounded-lg p-3 shadow-lg z-10"
                >
                    <label className="flex flex-col gap-1 text-xs text-neutral-400">
                        Name
                        <input
                            type="text"
                            value={draftName}
                            maxLength={MAX_USERNAME_LENGTH}
                            onChange={(e) => setDraftName(e.target.value)}
                            className="bg-neutral-600 rounded-sm text-sm text-white p-1"
                        />
                    </label>

                    <label className="flex flex-col gap-1 text-xs text-neutral-400">
                        Icon
                        <input
                            type="text"
                            value={user.icon}
                            disabled
                            title="Custom icons aren't supported yet"
                            className="bg-neutral-600 rounded-sm text-sm text-white p-1 truncate opacity-50 cursor-not-allowed"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={!canSave}
                        className="self-end px-3 py-1 rounded-sm bg-neutral-700 hover:bg-neutral-700/80 disabled:opacity-50 disabled:hover:bg-neutral-700 cursor-pointer disabled:cursor-not-allowed"
                    >
                        Save
                    </button>
                </form>
            )}
        </div>
    );
}
