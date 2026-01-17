import { useState, useEffect, useCallback, useRef } from 'react';
import { X, FileText } from 'lucide-react';
import { useDocumentStore } from '../../store';
import FormattedText from '../Outline/FormattedText';

function NotePanel() {
  const isOpen = useDocumentStore((state) => state.isNotePanelOpen);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const selectedNodeIds = useDocumentStore((state) => state.selectedNodeIds);
  const nodes = useDocumentStore((state) => state.nodes);
  const node = selectedNodeId ? nodes[selectedNodeId] : null;
  const closeNotePanel = useDocumentStore((state) => state.closeNotePanel);
  const setNodeNote = useDocumentStore((state) => state.setNodeNote);

  const [isEditing, setIsEditing] = useState(false);
  const [editingNote, setEditingNote] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasMultipleSelection = selectedNodeIds.length > 1;
  const currentNote = node?.note || '';

  // Update editing state when node changes
  useEffect(() => {
    if (node) {
      setEditingNote(currentNote);
    }
  }, [selectedNodeId, currentNote]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditingNote(currentNote);
  }, [currentNote]);

  const handleSave = useCallback(() => {
    if (selectedNodeId) {
      setNodeNote(selectedNodeId, editingNote || undefined);
    }
    setIsEditing(false);
  }, [selectedNodeId, editingNote, setNodeNote]);

  const handleCancel = useCallback(() => {
    setEditingNote(currentNote);
    setIsEditing(false);
  }, [currentNote]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
      // Cmd/Ctrl+Enter to save
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleCancel, handleSave]
  );

  if (!isOpen) return null;

  return (
    <div className="flex-1 min-h-0 flex flex-col border-t first:border-t-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Note
          </span>
          {hasMultipleSelection && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded">
              {selectedNodeIds.length} nodes
            </span>
          )}
        </div>
        <button
          onClick={closeNotePanel}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* No node selected message */}
      {selectedNodeIds.length === 0 || !node ? (
        <div className="flex-1 flex items-center justify-center p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Select a node to add a note
        </div>
      ) : hasMultipleSelection ? (
        <div className="flex-1 flex items-center justify-center p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Multiple nodes selected. Select a single node to edit its note.
        </div>
      ) : (
        <>
          {/* Note content */}
          <div className="flex-1 overflow-y-auto p-3">
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-full min-h-[200px] p-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter note... (supports inline formatting like <b>bold</b>, <i>italic</i>, etc.)"
              />
            ) : currentNote ? (
              <div
                className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={handleStartEdit}
              >
                <FormattedText text={currentNote} />
              </div>
            ) : (
              <div
                className="text-sm text-gray-400 dark:text-gray-500 italic cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={handleStartEdit}
              >
                Click to add a note...
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            {isEditing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartEdit}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {currentNote ? 'Edit Note' : 'Add Note'}
              </button>
            )}
            <div className="text-xs text-gray-400">
              {isEditing ? 'Cmd/Ctrl+Enter to save, Esc to cancel' : 'Click to edit'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default NotePanel;
