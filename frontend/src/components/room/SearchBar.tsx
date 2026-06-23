import { Search } from "lucide-react";
import { useRef } from "react";

/** 
 * Props for SearchBar component.
 */
type SearchBarProps = {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClick: () => void;
};


/**
 * Renders a search bar with an input field and a search button.
 */
export default function SearchBar({ onChange, onClick }: SearchBarProps) {
  const searchBarInputRef = useRef<HTMLInputElement | null>(null);


  const handleClick = () => {
    if (!searchBarInputRef.current) return;
    searchBarInputRef.current.value = "";

    onClick();
  }

  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    handleClick();
  }

  return (
    <div className="flex flex-1 min-h-8 max-w-3xl border border-gray-300/40 rounded-lg overflow-hidden shadow-sm">
      <input
        ref={searchBarInputRef}
        type="text"
        placeholder="Enter a url..."
        onChange={onChange}
        className="w-full px-4 outline-none"
        onKeyDown={handleEnter}
      />
      <button className="px-2 py-2 bg-neutral-700 border-l-0 hover:cursor-pointer hover:bg-neutral-700/80"
        onClick={handleClick}
      >
        <Search className="w-5 h-5 text-gray-600 stroke-gray-100" />
      </button>

    </div>
  );
}
