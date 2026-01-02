import { useState, useEffect, useRef } from 'react';
import { useDocumentStore } from '../../store';
import { Link, X, ExternalLink, FileText, Trash2, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

function LinkDialog() {
  const isOpen = useDocumentStore((state) => state.isLinkDialogOpen);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const nodes = useDocumentStore((state) => state.nodes);
  const node = selectedNodeId ? nodes[selectedNodeId] : null;
  const closeLinkDialog = useDocumentStore((state) => state.closeLinkDialog);
  const setNodeLink = useDocumentStore((state) => state.setNodeLink);

  const [linkValue, setLinkValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize link value when dialog opens
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
      closeLinkDialog();
    }
  };

  const handleRemove = () => {
    if (selectedNodeId) {
      setNodeLink(selectedNodeId, undefined);
      closeLinkDialog();
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

  // Show a message if no node is selected
  if (!selectedNodeId || !node) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={closeLinkDialog}
        />

        {/* Dialog */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Link className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Link
              </h2>
            </div>
            <button
              onClick={closeLinkDialog}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Select a node to add a link
          </div>
        </div>
      </div>
    );
  }

  const nodeText = node.content.type === 'text' ? node.content.text : '[image]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeLinkDialog}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Link className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {node.link ? 'Edit Link' : 'Add Link'}
            </h2>
          </div>
          <button
            onClick={closeLinkDialog}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Node name display */}
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Node: <span className="font-medium text-gray-700 dark:text-gray-300">{nodeText}</span>
          </div>

          {/* Link input */}
          <div>
            <label
              htmlFor="link-input"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={handleBrowse}
                className="px-3 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-md flex items-center gap-1"
                title="Browse for file"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="text-sm">Browse</span>
              </button>
            </div>
          </div>

          {/* Link type indicator */}
          {linkValue && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              {linkType === 'url' && (
                <>
                  <ExternalLink className="w-4 h-4" />
                  <span>Will open in browser</span>
                </>
              )}
              {linkType === 'mindmap' && (
                <>
                  <FileText className="w-4 h-4 text-purple-500" />
                  <span className="text-purple-500">Will open in new Mind the Map window</span>
                </>
              )}
              {linkType === 'file' && (
                <>
                  <FileText className="w-4 h-4" />
                  <span>Will open with default app</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            {node.link && (
              <button
                onClick={handleRemove}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
                Remove Link
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={closeLinkDialog}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-md"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LinkDialog;
