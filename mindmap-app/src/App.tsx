import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import { OutlineView } from './components/Outline';
import { MindMapView } from './components/MindMap';
import { SearchDialog } from './components/Search';
import { IconPicker } from './components/IconPicker';
import { HelpDialog } from './components/Help';
import { LinkDialog } from './components/LinkDialog';
import { useDocumentStore } from './store';
import { useAutoSave, useInitialFileLoad } from './hooks';

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
  const isHelpOpen = useDocumentStore((state) => state.isHelpOpen);
  const toggleHelp = useDocumentStore((state) => state.toggleHelp);
  const editingNodeId = useDocumentStore((state) => state.editingNodeId);
  const currentFilePath = useDocumentStore((state) => state.currentFilePath);
  const isDirty = useDocumentStore((state) => state.isDirty);
  const isLinkDialogOpen = useDocumentStore((state) => state.isLinkDialogOpen);
  const openLinkDialog = useDocumentStore((state) => state.openLinkDialog);

  // Enable autosave (30 seconds after last change, only if file has been saved before)
  useAutoSave();

  // Load file from URL query parameter (for opening .mindmap links in new window)
  useInitialFileLoad();

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

  // Handle global keyboard shortcuts (Ctrl+1, Ctrl+2, Ctrl+F, ?, Ctrl+/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      // Help shortcut: ? key (when not editing) or Cmd+/
      if (e.key === '?' && !editingNodeId && !isSearchOpen) {
        e.preventDefault();
        toggleHelp();
        return;
      }

      if (isMod && e.key === '/') {
        e.preventDefault();
        toggleHelp();
        return;
      }

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
      } else if (e.key === 'k' && !isLinkDialogOpen) {
        e.preventDefault();
        openLinkDialog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode, isSearchOpen, isHelpOpen, openSearch, toggleHelp, editingNodeId, isLinkDialogOpen, openLinkDialog]);

  // Listen for Tauri menu events (View menu) - filter by window label in payload
  useEffect(() => {
    const myLabel = getCurrentWindow().label;
    const listeners = [
      listen<string>('menu-view-mindmap', (event) => {
        if (event.payload === myLabel) setViewMode('mindmap');
      }),
      listen<string>('menu-view-outline', (event) => {
        if (event.payload === myLabel) setViewMode('outline');
      }),
      listen<string>('menu-find', (event) => {
        if (event.payload === myLabel) openSearch();
      }),
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

        {/* Mode toggle and help */}
        <div className="flex items-center gap-3">
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

          {/* Help button */}
          <button
            onClick={toggleHelp}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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

      {/* Link dialog */}
      <LinkDialog />

      {/* Help dialog */}
      <HelpDialog />
    </div>
  );
}

export default App;
