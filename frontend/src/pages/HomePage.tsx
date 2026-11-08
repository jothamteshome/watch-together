import { useEffect, useState } from "react";
import AppHeader from "../components/common/AppHeader";
import CreateRoom from "../components/home/CreateRoom";
import JoinRoom from "../components/home/JoinRoom";
import { getOrCreateProfile, saveProfile } from "../utils/identity";
import type User from "@shared/interfaces/User";
import type { UserUpdateEvent } from "@shared/interfaces/UserEvents";

export default function HomePage() {
  const [user, setUser] = useState<User | undefined>();

  useEffect(() => {
    let cancelled = false;

    getOrCreateProfile()
      .then((profile) => { if (!cancelled) setUser(profile); })
      .catch(() => {
        // No profile (e.g. backend unreachable): the page works without the menu, and the room generates one on join
      });

    return () => { cancelled = true; };
  }, []);

  // No room to tell yet, so a rename only changes the stored profile that the next join sends
  const updateProfile = (changes: UserUpdateEvent) => {
    if (!user) return;

    const updated: User = { ...user, ...changes };
    saveProfile(updated);
    setUser(updated);
  };

  return (
    <div className="w-full min-h-screen flex flex-col">
      <AppHeader user={user} onUpdateProfile={updateProfile} />
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="p-10 flex flex-col items-center gap-8 w-full max-w-sm">
          <CreateRoom />
          <JoinRoom />
        </div>
      </div>
    </div>
  );
}
