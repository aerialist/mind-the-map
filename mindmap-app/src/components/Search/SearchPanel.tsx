import { useEffect, useRef, useMemo } from 'react';
import { X, Search, Filter } from 'lucide-react';
import { useDocumentStore } from '../../store';
import {
  ICON_DEFINITIONS,
  ICON_CATEGORY_LABELS,
  type IconCategory,
  type IconDefinition,
} from '../../types/icons';

function SearchPanel() {
  const isSearchOpen = useDocumentStore((state) => state.isSearchOpen);
  const searchQuery = useDocumentStore((state) => state.searchQuery);
  const searchResults = useDocumentStore((state) => state.searchResults);
  const searchSelectedIndex = useDocumentStore((state) => state.searchSelectedIndex);
  const activeIconFilters = useDocumentStore((state) => state.activeIconFilters);
  const availableIcons = useDocumentStore((state) => state.availableIcons);
  const closeSearch = useDocumentStore((state) => state.closeSearch);
  const setSearchQuery = useDocumentStore((state) => state.setSearchQuery);
  const selectNodeFromSearch = useDocumentStore((state) => state.selectNodeFromSearch);
  const toggleActiveIconFilter = useDocumentStore((state) => state.toggleActiveIconFilter);
  const clearActiveIconFilters = useDocumentStore((state) => state.clearActiveIconFilters);

  // Group available icons by category
  const iconsByCategory = useMemo(() => {
    const grouped: Record<IconCategory, IconDefinition[]> = {
      priority: [],
      status: [],
      flag: [],
      mood: [],
      time: [],
      people: [],
      communication: [],
      document: [],
      symbol: [],
      notice: [],
    };

    for (const availableIcon of availableIcons) {
      const categoryDefs = ICON_DEFINITIONS[availableIcon.type as IconCategory];
      const def = categoryDefs?.find((d) => d.value === availableIcon.value);
      if (def) {
        grouped[availableIcon.type as IconCategory].push(def);
      }
    }

    return grouped;
  }, [availableIcons]);

  // Check if an icon filter is active
  const isIconFilterActive = (def: IconDefinition) => {
    return activeIconFilters.some(
      (f: { type: string; value: string | number }) => f.type === def.type && f.value === def.value
    );
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  // Focus input when panel opens
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
        const nextIndex = Math.min(searchSelectedIndex + 1, searchResults.length - 1);
        selectNodeFromSearch(nextIndex);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        const prevIndex = Math.max(searchSelectedIndex - 1, 0);
        selectNodeFromSearch(prevIndex);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        selectNodeFromSearch(searchSelectedIndex);
      }
    }
  };

  const handleResultClick = (index: number) => {
    selectNodeFromSearch(index);
  };

  if (!isSearchOpen) {
    return null;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col border-t first:border-t-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Search & Filter
        </span>
        <button
          onClick={closeSearch}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Filter Section */}
      {availableIcons.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Filter View
              </span>
              {activeIconFilters.length > 0 && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                  {activeIconFilters.length} active
                </span>
              )}
            </div>
            {activeIconFilters.length > 0 && (
              <button
                onClick={clearActiveIconFilters}
                className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {(Object.keys(iconsByCategory) as IconCategory[]).map((category) => {
              const icons = iconsByCategory[category];
              if (icons.length === 0) return null;
              return (
                <div key={category} className="flex flex-wrap gap-1 items-center">
                  <span className="text-xs text-gray-400 w-14 shrink-0">
                    {ICON_CATEGORY_LABELS[category]}
                  </span>
                  <div className="flex flex-wrap gap-0.5">
                    {icons.map((def) => {
                      const Icon = def.icon;
                      const active = isIconFilterActive(def);
                      return (
                        <button
                          key={`${def.type}-${def.value}`}
                          onClick={() =>
                            toggleActiveIconFilter({
                              type: def.type,
                              value: def.value,
                            })
                          }
                          className={`p-1 rounded transition-colors ${
                            active
                              ? 'bg-blue-100 dark:bg-blue-900 ring-1 ring-blue-400'
                              : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          title={def.label}
                        >
                          {def.text ? (
                            <span
                              className="w-4 h-4 flex items-center justify-center text-xs font-bold"
                              style={{ color: def.color }}
                            >
                              {def.text}
                            </span>
                          ) : (
                            <Icon
                              size={14}
                              style={{ color: def.color }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Search size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Search
            </span>
            {searchQuery && searchResults.length > 0 && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                {searchResults.length} hit{searchResults.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="Search nodes..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Search Results */}
      <div
        ref={resultsRef}
        className="flex-1 overflow-y-auto"
      >
        {searchQuery ? (
          searchResults.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No matching nodes
            </div>
          ) : (
            <div className="py-1">
              {searchResults.map((result, index) => (
                <div
                  key={result.nodeId}
                  data-index={index}
                  onClick={() => handleResultClick(index)}
                  className={`px-3 py-2 cursor-pointer border-l-2 ${
                    index === searchSelectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500'
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="text-sm text-gray-900 dark:text-gray-100">
                    {highlightMatch(result.text, searchQuery)}
                  </div>
                  {result.path.length > 1 && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {result.path.slice(0, -1).join(' › ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="p-4 text-center text-sm text-gray-400">
            Type to search nodes
          </div>
        )}
      </div>

      {/* Footer hints */}
      <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 flex gap-3">
        <span>↑↓ Navigate</span>
        <span>Enter Select</span>
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

export default SearchPanel;
