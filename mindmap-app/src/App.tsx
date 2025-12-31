import { useEffect } from 'react';
import './App.css';
import { OutlineView } from './components/Outline';
import { MindMapView } from './components/MindMap';
import { useDocumentStore } from './store';

function App() {
  const viewMode = useDocumentStore((state) => state.viewMode);
  const setViewMode = useDocumentStore((state) => state.setViewMode);

  // Handle mode switching keyboard shortcuts (Ctrl+1, Ctrl+2)
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setViewMode]);

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
    </div>
  );
}

export default App;
