import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const REDIRECT_SECONDS = 5;

export default function RoomNotFound() {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) navigate("/", { replace: true });
  }, [secondsLeft, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-4 text-center">
      <h1 className="text-2xl font-semibold">Room Not Found</h1>
      <p className="text-gray-400">This room doesn't exist or has expired.</p>
      <p className="text-gray-500 text-sm">Redirecting to home in {Math.max(secondsLeft, 0)}s...</p>
      <button
        className="bg-red-600 text-white font-medium px-6 py-3 rounded-lg shadow hover:bg-red-700 transition"
        onClick={() => navigate("/", { replace: true })}
      >
        Go Home
      </button>
    </div>
  );
}
