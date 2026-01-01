import { useEffect, useRef } from 'react';
import { useDocumentStore } from '../../store';

function SearchDialog() {
  const isSearchOpen = useDocumentStore((state) => state.isSearchOpen);
  const searchQuery = useDocumentStore((state) => state.searchQuery);
  const searchResults = useDocumentStore((state) => state.searchResults);
  const searchSelectedIndex = useDocumentStore((state) => state.searchSelectedIndex);
  const closeSearch = useDocumentStore((state) => state.closeSearch);
  const setSearchQuery = useDocumentStore((state) => state.setSearchQuery);
  const selectSearchResult = useDocumentStore((state) => state.selectSearchResult);
  const navigateToSearchResult = useDocumentStore((state) => state.navigateToSearchResult);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  // Focus input when dialog opens
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Scroll selected result into view
  useEffect(() => {
    if (resultsRef.current && searchResults.length > 0) {
      const selectedElement = resultsRef.current.querySelector(
        `[data-index="${searchSelectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [searchSelectedIndex, searchResults.length]);

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ignore key events during IME composition
    if (e.nativeEvent.isComposing || isComposingRef.current || e.keyCode === 229) {
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchResults.length > 0) {
        selectSearchResult(
          Math.min(searchSelectedIndex + 1, searchResults.length - 1)
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        selectSearchResult(Math.max(searchSelectedIndex - 1, 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        navigateToSearchResult();
      }
    }
  };

  const handleResultClick = (index: number) => {
    selectSearchResult(index);
    navigateToSearchResult();
  };

  if (!isSearchOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={closeSearch}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Search input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="ノードを検索..."
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            {searchQuery && (
              <span className="text-sm text-gray-400">
                {searchResults.length} 件
              </span>
            )}
          </div>
        </div>

        {/* Results */}
        {searchQuery && (
          <div
            ref={resultsRef}
            className="max-h-80 overflow-y-auto"
          >
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                一致するノードが見つかりません
              </div>
            ) : (
              <div className="py-2">
                {searchResults.map((result, index) => (
                  <div
                    key={result.nodeId}
                    data-index={index}
                    onClick={() => handleResultClick(index)}
                    className={`px-4 py-2 cursor-pointer ${
                      index === searchSelectedIndex
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-gray-900 dark:text-gray-100 font-medium">
                      {highlightMatch(result.text, searchQuery)}
                    </div>
                    {result.path.length > 1 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {result.path.slice(0, -1).join(' > ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Keyboard hints */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 flex gap-4">
          <span>↑↓ 移動</span>
          <span>Enter 選択</span>
          <span>Esc 閉じる</span>
        </div>
      </div>
    </div>
  );
}

// Helper to highlight matching text
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <span className="bg-yellow-200 dark:bg-yellow-700 rounded px-0.5">
        {match}
      </span>
      {after}
    </>
  );
}

export default SearchDialog;
