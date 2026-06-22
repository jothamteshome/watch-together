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

  return (
    <div className="flex flex-1 min-h-8 max-w-3xl border border-gray-300 rounded-xl overflow-hidden shadow-sm">
      <input
        ref={searchBarInputRef}
        type="text"
        placeholder="Enter a url..."
        onChange={onChange}
        className="w-full px-4 outline-none"
      />
      <button className="px-4 py-2 bg-gray-100 border border-gray-300 border-l-0 rounded-r-xl hover:cursor-pointer hover:bg-gray-200"
        onClick={handleClick}>
        <Search className="w-5 h-5 text-gray-600" />
      </button>

    </div>
  );
}
