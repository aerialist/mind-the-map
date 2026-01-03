import { useState, useEffect, useRef } from 'react';
import { useDocumentStore } from '../../store';
import { Link, X, ExternalLink, FileText, Trash2, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

function LinkPanel() {
  const isOpen = useDocumentStore((state) => state.isLinkDialogOpen);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const nodes = useDocumentStore((state) => state.nodes);
  const node = selectedNodeId ? nodes[selectedNodeId] : null;
  const closeLinkDialog = useDocumentStore((state) => state.closeLinkDialog);
  const setNodeLink = useDocumentStore((state) => state.setNodeLink);

  const [linkValue, setLinkValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize link value when panel opens or node changes
  useEffect(() => {
    if (isOpen && node) {
      setLinkValue(node.link || '');
      // Focus input after a short delay
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, node]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeLinkDialog();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, closeLinkDialog]);

  const handleSave = () => {
    if (selectedNodeId) {
      setNodeLink(selectedNodeId, linkValue);
    }
  };

  const handleRemove = () => {
    if (selectedNodeId) {
      setNodeLink(selectedNodeId, undefined);
      setLinkValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleBrowse = async () => {
    try {
      const path = await open({
        multiple: false,
        directory: false,
      });

      if (path) {
        setLinkValue(path);
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
    }
  };

  // Determine link type for display
  const getLinkType = (link: string): 'url' | 'mindmap' | 'file' => {
    if (!link) return 'url';
    if (link.startsWith('http://') || link.startsWith('https://')) return 'url';
    if (link.endsWith('.mindmap')) return 'mindmap';
    return 'file';
  };

  const linkType = getLinkType(linkValue);

  if (!isOpen) return null;

  const nodeText = node?.content.type === 'text' ? node.content.text : node ? '[image]' : '';

  return (
    <div className="w-80 h-full flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Link size={16} className="text-purple-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Link
          </span>
        </div>
        <button
          onClick={closeLinkDialog}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* No node selected message */}
      {!selectedNodeId || !node ? (
        <div className="flex-1 flex items-center justify-center p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Select a node to add a link
        </div>
      ) : (
        <>
          {/* Node info */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Node
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
              {nodeText}
            </div>
          </div>

          {/* Link input section */}
          <div className="px-3 py-3 space-y-3">
            <div>
              <label
                htmlFor="link-input"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5"
              >
                URL or File Path
              </label>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  id="link-input"
                  type="text"
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="https://... or /path/to/file"
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleBrowse}
                  className="px-2 py-1.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded flex items-center"
                  title="Browse for file"
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>

            {/* Link type indicator */}
            {linkValue && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                {linkType === 'url' && (
                  <>
                    <ExternalLink size={14} />
                    <span>Opens in browser</span>
                  </>
                )}
                {linkType === 'mindmap' && (
                  <>
                    <FileText size={14} className="text-purple-500" />
                    <span className="text-purple-500">Opens in new window</span>
                  </>
                )}
                {linkType === 'file' && (
                  <>
                    <FileText size={14} />
                    <span>Opens with default app</span>
                  </>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {node.link && (
                  <button
                    onClick={handleRemove}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={!linkValue.trim()}
                className="px-3 py-1 text-sm text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded"
              >
                Save
              </button>
            </div>
          </div>

          {/* Footer hints */}
          <div className="mt-auto px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 flex gap-3">
            <span>Enter Save</span>
            <span>Esc Close</span>
          </div>
        </>
      )}
    </div>
  );
}

export default LinkPanel;
