import CreateRoom from "../components/home/CreateRoom";
import JoinRoom from "../components/home/JoinRoom";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="p-10 flex flex-col items-center gap-8 w-full max-w-sm">
        <CreateRoom />
        <JoinRoom />
      </div>
    </div>
  );
}
