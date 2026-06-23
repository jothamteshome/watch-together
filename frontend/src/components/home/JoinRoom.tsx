import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkRoomExists } from '../../services/room';

export default function JoinRoom() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState<string>("");
  const [invalidRoom, setInvalidRoom] = useState<boolean>(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInvalidRoom(false);
    setRoomId(e.target.value);
  };

  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    
    onClick();
  }


  const onClick = async () => {
    if (!roomId) {
      setInvalidRoom(true);
      return;
    }

    try {
      const exists = await checkRoomExists(roomId);
      if (!exists) {
        setInvalidRoom(true);
        return;
      }
      navigate(`/room/${roomId}`);
    } catch {
      setInvalidRoom(true);
    }
  };

  const getRoomInputColor = () => {
    if (invalidRoom) return "outline-2 outline-red-600 focus:outline-none focus:ring-2 focus:ring-red-600";
    else return "outline outline-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500";
  };

  return (
    <div className="flex gap-3 w-full">
      <input
        type="text"
        placeholder="Enter Room ID"
        className={`bg-white text-black flex-1 px-4 py-3 rounded-lg transition ${getRoomInputColor()}`}
        onChange={onChange}
        onKeyDown={onEnter}
        id="roomIdInput"
      />
      <button
        className="bg-red-600 text-white font-medium px-6 py-3 rounded-lg shadow hover:bg-red-700 transition"
        onClick={onClick}
      >
        Join
      </button>
    </div>
  );
}
