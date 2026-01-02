import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import { OutlineView } from './components/Outline';
import { MindMapView } from './components/MindMap';
import { SearchDialog } from './components/Search';
import { IconPicker } from './components/IconPicker';
import { useDocumentStore } from './store';
import { useAutoSave } from './hooks';

const getFileNameFromPath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
};

function App() {
  const viewMode = useDocumentStore((state) => state.viewMode);
  const setViewMode = useDocumentStore((state) => state.setViewMode);
  const isSearchOpen = useDocumentStore((state) => state.isSearchOpen);
  const openSearch = useDocumentStore((state) => state.openSearch);
  const currentFilePath = useDocumentStore((state) => state.currentFilePath);
  const isDirty = useDocumentStore((state) => state.isDirty);

  // Enable autosave (30 seconds after last change, only if file has been saved before)
  useAutoSave();

  // Sync native window title with current file
  useEffect(() => {
    const fileLabel = currentFilePath
      ? getFileNameFromPath(currentFilePath)
      : 'Untitled';
    const dirtyMark = isDirty ? '* ' : '';
    const title = `${dirtyMark}${fileLabel} — Mind the Map`;

    getCurrentWindow()
      .setTitle(title)
      .catch(() => {
        // Ignore when not running in Tauri (e.g. `pnpm dev`)
      });
  }, [currentFilePath, isDirty]);

  // Handle global keyboard shortcuts (Ctrl+1, Ctrl+2, Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      if (e.key === '1') {
        e.preventDefault();
        setViewMode('mindmap');
      } else if (e.key === '2') {
        e.preventDefault();
        setViewMode('outline');
      } else if (e.key === 'f' && !isSearchOpen) {
        e.preventDefault();
        openSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode, isSearchOpen, openSearch]);

  // Listen for Tauri menu events (View menu)
  useEffect(() => {
    const listeners = [
      listen('menu-view-mindmap', () => setViewMode('mindmap')),
      listen('menu-view-outline', () => setViewMode('outline')),
      listen('menu-find', () => openSearch()),
    ];

    return () => {
      listeners.forEach((unlisten) => unlisten.then((fn) => fn()));
    };
  }, [setViewMode, openSearch]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-semibold">Mind the Map</h1>

        {/* Mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('mindmap')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'mindmap'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setViewMode('outline')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'outline'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Outline
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {viewMode === 'mindmap' ? <MindMapView /> : <OutlineView />}
      </main>

      {/* Search dialog */}
      <SearchDialog />

      {/* Icon picker dialog */}
      <IconPicker />
    </div>
  );
}

export default App;
