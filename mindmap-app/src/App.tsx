import { useEffect } from 'react';
import './App.css';
import { OutlineView } from './components/Outline';
import { MindMapView } from './components/MindMap';
import { SearchPanel } from './components/Search';
import { IconPicker } from './components/IconPicker';
import { HelpDialog } from './components/Help';
import { AboutDialog } from './components/About';
import { LinkPanel } from './components/LinkDialog';
import { SettingsDialog } from './components/Settings';
import { Toast } from './components/Toast';
import { useDocumentStore } from './store';
import { useSettingsStore } from './store/settingsStore';
import { useAutoSave, useInitialFileLoad } from './hooks';
import { openDocumentByPath } from './services/tauri/fileSystem';
import { isTauriAvailable, safeInvoke, safeListen, safeGetCurrentWindow } from './services/tauri/safeTauri';
import { Filter, EyeOff, Upload, Download, Loader2 } from 'lucide-react';
import { dispatch, type CommandPayload } from './services/commandBus';
import { invoke } from '@tauri-apps/api/core';

const getFileNameFromPath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
};

function App() {
  const viewMode = useDocumentStore((state) => state.viewMode);
  const setViewMode = useDocumentStore((state) => state.setViewMode);
  const isSearchOpen = useDocumentStore((state) => state.isSearchOpen);
  const isIconPickerOpen = useDocumentStore((state) => state.isIconPickerOpen);
  const toggleSearch = useDocumentStore((state) => state.toggleSearch);
  const toggleHelp = useDocumentStore((state) => state.toggleHelp);
  const editingNodeId = useDocumentStore((state) => state.editingNodeId);
  const currentFilePath = useDocumentStore((state) => state.currentFilePath);
  const isDirty = useDocumentStore((state) => state.isDirty);
  const isLinkDialogOpen = useDocumentStore((state) => state.isLinkDialogOpen);
  const activeIconFilters = useDocumentStore((state) => state.activeIconFilters);
  const clearActiveIconFilters = useDocumentStore((state) => state.clearActiveIconFilters);
  const hiddenIconFilters = useDocumentStore((state) => state.hiddenIconFilters);
  const clearHiddenIconFilters = useDocumentStore((state) => state.clearHiddenIconFilters);
  const rootId = useDocumentStore((state) => state.rootId);
  const nodes = useDocumentStore((state) => state.nodes);
  const isSyncing = useDocumentStore((state) => state.isSyncing);
  const syncOperation = useDocumentStore((state) => state.syncOperation);

  // Settings store
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const theme = useSettingsStore((state) => state.settings.appearance.theme);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Apply theme setting
  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (theme === 'system') {
      // Use system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      // Listen for system theme changes
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [theme]);

  // Enable autosave (uses settings for interval)
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

    safeGetCurrentWindow().then((win) => {
      win.setTitle(title);
    });
  }, [currentFilePath, isDirty]);

  // Handle global keyboard shortcuts (Ctrl+F, Ctrl+K, Ctrl+M, Ctrl+1, Ctrl+2, Ctrl+Shift+F, ?, Ctrl+/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      // Help shortcut: ? key (when not editing) or Cmd+/
      if (e.key === '?' && !editingNodeId && !isSearchOpen) {
        e.preventDefault();
        dispatch('app.help.toggle');
        return;
      }

      if (isMod && e.key === '/') {
        e.preventDefault();
        dispatch('app.help.toggle');
        return;
      }

      // Settings shortcut: Cmd+, (comma)
      if (isMod && e.key === ',') {
        e.preventDefault();
        dispatch('app.settings.toggle');
        return;
      }

      if (!isMod) return;

      const key = e.key.toLowerCase();

      if (key === 'm') {
        e.preventDefault();
        dispatch('view.toggle');
      } else if (key === '1') {
        e.preventDefault();
        dispatch('view.mindmap');
      } else if (key === '2') {
        e.preventDefault();
        dispatch('view.outline');
      } else if (key === 'f') {
        e.preventDefault();
        if (e.shiftKey && viewMode === 'mindmap') {
          dispatch('view.fitToView');
        } else if (!e.shiftKey) {
          dispatch('view.find');
        }
      } else if (key === 'k') {
        e.preventDefault();
        dispatch('node.addLink');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isSearchOpen, editingNodeId]);

  // Listen for command dispatch events from Rust
  useEffect(() => {
    let isCancelled = false;
    let unlistenFn: (() => void) | undefined;

    safeListen<CommandPayload>('command:dispatch', (event) => {
      if (isCancelled) return;
      const payload = event.payload;
      if (!payload?.id) return;
      dispatch(payload.id, payload.args);
    }).then((fn) => {
      if (isCancelled) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      isCancelled = true;
      if (unlistenFn) {
        try { unlistenFn(); } catch {}
      }
    };
  }, []);

  // Update Workflowy menu visibility based on root node sync status
  // Only watch for the workflowySync property specifically to avoid unnecessary updates
  // Use a boolean to avoid object reference comparison issues
  const hasWorkflowySync = rootId ? !!nodes[rootId]?.workflowySync : false;

  useEffect(() => {
    if (!isTauriAvailable()) return;

    const updateWorkflowyMenu = async () => {
      try {
        await invoke('update_workflowy_menu', { show: hasWorkflowySync });
      } catch {
        // Menu API unavailable or error occurred
      }
    };

    updateWorkflowyMenu();
  }, [rootId, hasWorkflowySync]);

  // Report window focus to Rust for active window routing
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const setupWindowFocus = async () => {
      if (!isTauriAvailable()) return;

      try {
        const windowHandle = await safeGetCurrentWindow();
        const label = windowHandle.label;

        const notifyActive = () => {
          safeInvoke('window_activated', { label });
        };

        notifyActive();
        const unlisten = await windowHandle.onFocusChanged(({ payload: focused }: { payload: boolean }) => {
          if (focused) notifyActive();
        });
        unlistenFn = unlisten;
      } catch {
        // Ignore when not running in Tauri
      }
    };

    setupWindowFocus();

    return () => {
      if (unlistenFn) {
        try { unlistenFn(); } catch {}
      }
    };
  }, []);

  // Listen for file open events when app is already running (e.g., via deep link)
  useEffect(() => {
    const loadDocument = useDocumentStore.getState().loadDocument;
    let isCancelled = false;
    let unlistenFn: (() => void) | undefined;

    safeListen<string>('open-file', async (event) => {
      if (isCancelled) return;
      const filePath = event.payload;

      if (!filePath || !filePath.endsWith('.mindmap')) return;

      // Load the file
      const result = await openDocumentByPath(filePath);
      if (result.success && result.nodes && result.rootId) {
        loadDocument(result.nodes, result.rootId, result.path || null);
      } else {
        console.error('Failed to load file from open event:', result.error);
      }
    }).then((fn) => {
      if (isCancelled) {
        fn();
      } else {
        unlistenFn = fn;
      }
    });

    return () => {
      isCancelled = true;
      if (unlistenFn) {
        try { unlistenFn(); } catch {}
      }
    };
  }, []);


  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-semibold">Mind the Map</h1>

        {/* Mode toggle and help */}
        <div className="flex items-center gap-3">
          {/* Workflowy Push/Pull buttons (only shown when document has Workflowy sync) */}
          {rootId && nodes[rootId]?.workflowySync && (
            <div className="flex gap-1 border-r border-gray-300 dark:border-gray-600 pr-3">
              <button
                onClick={() => dispatch('workflowy.push')}
                disabled={isSyncing}
                className={`flex items-center gap-1.5 px-2 py-1 text-sm rounded transition-colors ${
                  isSyncing
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title="Push changes to Workflowy"
              >
                {isSyncing && syncOperation === 'push' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                <span>{isSyncing && syncOperation === 'push' ? 'Pushing...' : 'Push'}</span>
              </button>
              <button
                onClick={() => dispatch('workflowy.pull')}
                disabled={isSyncing}
                className={`flex items-center gap-1.5 px-2 py-1 text-sm rounded transition-colors ${
                  isSyncing
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title="Pull updates from Workflowy"
              >
                {isSyncing && syncOperation === 'pull' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span>{isSyncing && syncOperation === 'pull' ? 'Pulling...' : 'Pull'}</span>
              </button>
            </div>
          )}

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

          {/* Filter active indicator */}
          {activeIconFilters.length > 0 && !isSearchOpen && (
            <button
              onClick={toggleSearch}
              className="flex items-center gap-1.5 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              title="Click to open Search & Filter panel"
            >
              <Filter size={12} />
              <span>{activeIconFilters.length} active</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearActiveIconFilters();
                }}
                className="ml-0.5 p-0.5 hover:bg-blue-300 dark:hover:bg-blue-700 rounded-full"
                title="Clear all filters"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </button>
          )}

          {/* Hidden filters indicator */}
          {hiddenIconFilters.length > 0 && !isSearchOpen && (
            <button
              onClick={toggleSearch}
              className="flex items-center gap-1.5 px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
              title="Click to open Search & Filter panel"
            >
              <EyeOff size={12} />
              <span>{hiddenIconFilters.length} hidden</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearHiddenIconFilters();
                }}
                className="ml-0.5 p-0.5 hover:bg-red-300 dark:hover:bg-red-700 rounded-full"
                title="Clear all hidden filters"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </button>
          )}

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

      {/* Main content with side panels */}
      <main className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden">
          {viewMode === 'mindmap' ? <MindMapView /> : <OutlineView />}
        </div>
        {/* Right sidebar panels - stacked vertically */}
        {(isIconPickerOpen || isSearchOpen || isLinkDialogOpen) && (
          <div className="w-80 flex flex-col border-l border-gray-200 dark:border-gray-700">
            {isIconPickerOpen && <IconPicker />}
            {isSearchOpen && <SearchPanel />}
            {isLinkDialogOpen && <LinkPanel />}
          </div>
        )}
      </main>

      {/* Help dialog */}
      <HelpDialog />

      {/* About dialog */}
      <AboutDialog />

      {/* Settings dialog */}
      <SettingsDialog />

      {/* Toast notifications */}
      <Toast />
    </div>
  );
}

export default App;
