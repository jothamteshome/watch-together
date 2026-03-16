import { useState, useEffect } from "react";
import { Info } from "lucide-react";


/**
 * Displays backend latency with color indicator.
 */
function LatencyIndicator({latency}: {latency: number | null}) {
  // Returns color class based on latency value
  const getLatencyColor = () => {
    if (latency === null) return "bg-gray-400";
    if (latency < 100) return "bg-green-500";
    if (latency < 250) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${getLatencyColor()}`}></span>
      <span>{latency !== null ? `${latency}ms` : "-"}</span>
    </div>
  );
}


/**
 * Displays button to copy room url to clipboard.
 */
function CopyRoomUrlButton({ copied, onCopy }: { copied: boolean, onCopy: () => void }) {
  // Returns color class for copy button based on copied state
  const getCopyColor = () => {
    if (copied) return "text-green-600";
    else return "text-blue-600";
  };


  return (
    <button
      onClick={onCopy}
      className={`ml-2 text-xs ${getCopyColor()} hover:underline cursor-pointer w-1/5`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}


/**
 * Displays room information including room ID, copy-to-clipboard functionality, and backend latency.
 */
export default function RoomInfo({ roomId }: { roomId: string }) {
  // State for backend latency (ms)
  const [latency, setLatency] = useState<number | null>(null);
  // State to show/hide info box
  const [show, setShow] = useState(false);
  // State to indicate if room ID was copied
  const [copied, setCopied] = useState(false);
  // State for backend version
  const [backendVersion, setBackendVersion] = useState<string | null>(null);


  // Ping backend every 5 seconds to measure latency
  useEffect(() => {
    const ping = async () => {
      const start = Date.now();
      try {
        await fetch(`${import.meta.env.VITE_APP_BACKEND_URL}/health`);
        setLatency(Date.now() - start);
      } catch {
        setLatency(null);
      }
    };
    ping();
    const interval = setInterval(ping, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch backend version once on mount
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_APP_BACKEND_URL}/version`);
        const data = await res.json();
        setBackendVersion(data.version ?? null);
      } catch {
        setBackendVersion(null);
      }
    };
    fetchVersion();
  }, []);
 

  // Handles copying room ID to clipboard
  const handleCopy = async () => {
    try {
      const roomUrl = `${window.location.origin}/room/${roomId}`;
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };


  return (
    <div className="relative self-start">
      {/* Info Button */}
      <button
        className="p-2 rounded-full hover:bg-gray-100"
        onClick={() => setShow((s) => !s)}
      >
        <Info className="w-5 h-5 text-gray-600" />
      </button>

      {/* Info Box */}
      {show && (
        <div className="absolute left-0 mt-2 ml-2 w-56 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
          <div className="text-sm text-gray-700">

            {/* Room ID and Copy Button */}
            <p className="font-semibold">Room:</p>
            <div className="flex w-full">
              <p className="font-mono flex items-center w-4/5 break-all">{roomId}</p>
              <CopyRoomUrlButton copied={copied} onCopy={handleCopy} />
            </div>

            {/* Latency Indicator */}
            <p className="mt-2 font-semibold">Latency:</p>
            <LatencyIndicator latency={latency} />

            {/* Version Info */}
            <p className="mt-2 font-semibold">Version:</p>
            <p className="font-mono text-xs">Frontend: v{__APP_VERSION__}</p>
            <p className="font-mono text-xs">Backend: {backendVersion !== null ? `v${backendVersion}` : "-"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
