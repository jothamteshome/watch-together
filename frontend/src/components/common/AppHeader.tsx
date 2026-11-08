import type { ReactNode } from "react";
import UserMenu from "../user/UserMenu";
import type User from "@shared/interfaces/User";
import type { UserUpdateEvent } from "@shared/interfaces/UserEvents";


interface AppHeaderProps {
    user?: User | undefined;
    onUpdateProfile: (changes: UserUpdateEvent) => void;
    /** The page's own content, spread across the bar */
    children?: ReactNode;
    /** Buttons grouped on the right, before the profile menu */
    actions?: ReactNode;
}


/**
 * The bar at the top of every page: the page's content, then its actions, with the profile menu always last.
 */
export default function AppHeader({ user, onUpdateProfile, children, actions }: AppHeaderProps) {
    // With children, justify-between places the right-hand group; auto margin would pull the children towards the left
    const alignRight = children ? "" : "ml-auto";

    return (
        <div className="w-full flex items-center justify-between gap-4 p-4">
            {children}
            <div className={`flex items-center gap-1 shrink-0 ${alignRight}`}>
                {actions}
                {user && <UserMenu user={user} onUpdate={onUpdateProfile} />}
            </div>
        </div>
    );
}
