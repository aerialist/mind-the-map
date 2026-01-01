import { useRef, useEffect, useState } from 'react';
import { useDocumentStore } from '../../store';
import { useDragContext } from './OutlineView';

interface OutlineNodeProps {
  nodeId: string;
  depth: number;
}

function OutlineNode({ nodeId, depth }: OutlineNodeProps) {
  const node = useDocumentStore((state) => state.nodes[nodeId]);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const editingNodeId = useDocumentStore((state) => state.editingNodeId);
  const selectNode = useDocumentStore((state) => state.selectNode);
  const startEditing = useDocumentStore((state) => state.startEditing);
  const stopEditing = useDocumentStore((state) => state.stopEditing);
  const updateNodeText = useDocumentStore((state) => state.updateNodeText);
  const createSiblingNode = useDocumentStore((state) => state.createSiblingNode);
  const createChildNode = useDocumentStore((state) => state.createChildNode);
  const toggleCollapse = useDocumentStore((state) => state.toggleCollapse);

  const { draggedNodeId, startDrag } = useDragContext();

  const inputRef = useRef<HTMLInputElement>(null);
  const [editText, setEditText] = useState('');
  const prevEditingRef = useRef(false);
  const isComposingRef = useRef(false);

  const isSelected = selectedNodeId === nodeId;
  const isEditing = editingNodeId === nodeId;
  const isDragging = draggedNodeId === nodeId;
  const isRoot = !node?.parentId;

  // Initialize edit text and focus when starting to edit
  useEffect(() => {
    // Only run when transitioning to editing mode
    if (isEditing && !prevEditingRef.current) {
      if (node?.content.type === 'text') {
        setEditText(node.content.text);
      }
      // Focus after a short delay to ensure text is set
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
    }
    prevEditingRef.current = isEditing;
  }, [isEditing, node]);

  if (!node) return null;

  const text = node.content.type === 'text' ? node.content.text : '[image]';
  const hasChildren = node.childIds.length > 0;

  const handleClick = () => {
    selectNode(nodeId);
  };

  const handleDoubleClick = () => {
    startEditing(nodeId);
  };

  const handleCollapseClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger node selection
    if (hasChildren) {
      toggleCollapse(nodeId);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditText(e.target.value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ignore all keys during IME composition (e.g., Japanese input)
    // During IME composition, keyCode is 229 or key is 'Process'
    if (e.nativeEvent.isComposing || isComposingRef.current || e.keyCode === 229 || e.key === 'Process') {
      return; // Let IME handle the key
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      // Save the current text and create sibling node
      updateNodeText(nodeId, editText);
      // For root node, just stop editing (can't create sibling of root)
      if (node?.parentId) {
        createSiblingNode(nodeId);
      } else {
        stopEditing();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Save the current text and create child node
      updateNodeText(nodeId, editText);
      createChildNode(nodeId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (e.ctrlKey) {
        // Ctrl+Escape: Cancel editing (don't save)
        stopEditing();
      } else {
        // Escape: Save and exit editing mode
        updateNodeText(nodeId, editText);
        stopEditing();
      }
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
  };

  const handleInputBlur = () => {
    // Save on blur
    updateNodeText(nodeId, editText);
    stopEditing();
  };

  // Mouse down to start drag
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag with left mouse button, and not on root or during editing
    if (e.button !== 0 || isRoot || isEditing) return;

    // Don't start drag if clicking on collapse button
    if ((e.target as HTMLElement).closest('[data-collapse-button]')) return;

    // Prevent text selection during drag
    e.preventDefault();

    // Start drag
    startDrag(nodeId);
  };

  return (
    <div className="select-none">
      {/* Node row */}
      <div
        data-node-id={nodeId}
        data-depth={depth}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        className={`flex items-center py-1 px-2 rounded cursor-pointer
          ${isSelected
            ? 'bg-blue-100 dark:bg-blue-900'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }
          ${isDragging ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {/* Collapse/expand indicator */}
        <span
          data-collapse-button
          onClick={handleCollapseClick}
          className={`w-4 h-4 flex items-center justify-center mr-1 text-gray-400 ${
            hasChildren ? 'cursor-pointer hover:text-gray-600 dark:hover:text-gray-300' : ''
          }`}
        >
          {hasChildren ? (node.isCollapsed ? '▶' : '▼') : '•'}
        </span>

        {/* Node text or input */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputBlur}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            className="flex-1 bg-white dark:bg-gray-800 border border-blue-400 rounded px-1 py-0 outline-none"
          />
        ) : (
          <span className="flex-1">{text}</span>
        )}
      </div>

      {/* Children */}
      {!node.isCollapsed &&
        node.childIds.map((childId) => (
          <OutlineNode key={childId} nodeId={childId} depth={depth + 1} />
        ))}
    </div>
  );
}

export default OutlineNode;
