import { useRef, useEffect, useState } from 'react';
import { useDocumentStore } from '../../store';
import { useDragContext, useVisibleNodes } from './OutlineView';
import { getIconDefinition, sortIconsByDisplayOrder, type NodeIcon } from '../../types';
import { Tags, Link } from 'lucide-react';
import { openLink } from '../../services/tauri';

interface OutlineNodeProps {
  nodeId: string;
  depth: number;
}

function OutlineNode({ nodeId, depth }: OutlineNodeProps) {
  const node = useDocumentStore((state) => state.nodes[nodeId]);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const selectedNodeIds = useDocumentStore((state) => state.selectedNodeIds);
  const editingNodeId = useDocumentStore((state) => state.editingNodeId);
  const selectNode = useDocumentStore((state) => state.selectNode);
  const toggleNodeSelection = useDocumentStore((state) => state.toggleNodeSelection);
  const selectNodeRange = useDocumentStore((state) => state.selectNodeRange);
  const startEditing = useDocumentStore((state) => state.startEditing);
  const stopEditing = useDocumentStore((state) => state.stopEditing);
  const updateNodeText = useDocumentStore((state) => state.updateNodeText);
  const createSiblingNode = useDocumentStore((state) => state.createSiblingNode);
  const createSiblingNodeAbove = useDocumentStore((state) => state.createSiblingNodeAbove);
  const createChildNode = useDocumentStore((state) => state.createChildNode);
  const toggleCollapse = useDocumentStore((state) => state.toggleCollapse);
  const openIconPicker = useDocumentStore((state) => state.openIconPicker);
  const cycleIcon = useDocumentStore((state) => state.cycleIcon);
  const toggleLinkPanel = useDocumentStore((state) => state.toggleLinkPanel);

  const { draggedNodeId, startDrag } = useDragContext();
  const visibleNodes = useVisibleNodes();

  const inputRef = useRef<HTMLInputElement>(null);
  const [editText, setEditText] = useState('');
  const prevEditingRef = useRef(false);
  const isComposingRef = useRef(false);

  const isSelected = selectedNodeIds.includes(nodeId);
  const isPrimarySelected = selectedNodeId === nodeId;
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
  const nodeIcons = node.icons || [];

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openIconPicker();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+click (or Cmd+click on Mac): Toggle this node in multi-selection
      toggleNodeSelection(nodeId);
    } else if (e.shiftKey) {
      // Shift+click: Select range from current selection to this node
      selectNodeRange(nodeId);
    } else {
      // Normal click: Single selection
      selectNode(nodeId);
    }
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
        if (e.shiftKey) {
          createSiblingNodeAbove(nodeId);
        } else {
          createSiblingNode(nodeId);
        }
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
        className={`group flex items-center py-1 px-2 rounded cursor-pointer
          ${isSelected
            ? isPrimarySelected
              ? 'bg-blue-100 dark:bg-blue-900'
              : 'bg-blue-50 dark:bg-blue-950'
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

        {/* Node icons */}
        {nodeIcons.length > 0 && (
          <span className="flex items-center gap-0.5 mr-1">
            {(() => {
              const sortedIcons = sortIconsByDisplayOrder(nodeIcons);
              // Create a map from sorted icon to its original index
              const sortedIconToOriginalIndex = new Map<number, number>();
              sortedIcons.forEach((sortedIcon: NodeIcon, sortedIdx: number) => {
                // Find the first unused original icon that matches
                for (let origIdx = 0; origIdx < nodeIcons.length; origIdx++) {
                  if (
                    nodeIcons[origIdx].type === sortedIcon.type &&
                    nodeIcons[origIdx].value === sortedIcon.value &&
                    !Array.from(sortedIconToOriginalIndex.values()).includes(origIdx)
                  ) {
                    sortedIconToOriginalIndex.set(sortedIdx, origIdx);
                    break;
                  }
                }
              });
              
              return sortedIcons.map((icon: NodeIcon, index: number) => {
                const def = getIconDefinition(icon);
                if (!def) return null;
                const IconComponent = def.icon;
                const originalIconIndex = sortedIconToOriginalIndex.get(index) ?? index;
                return (
                  <button
                    key={`${icon.type}-${index}`}
                    className="relative cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleIcon(nodeId, originalIconIndex);
                    }}
                    title={`${def.label} (click to cycle)`}
                  >
                  <IconComponent
                    className="w-4 h-4"
                    style={{ color: def.color }}
                  />
                  {def.text && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[8px] font-bold pointer-events-none"
                      style={{ color: def.color }}
                    >
                      {def.text}
                    </span>
                  )}
                </button>
              );
              });
            })()}
          </span>
        )}

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
          <span className="flex-1">
            <span
              className={node.link ? 'text-purple-600 dark:text-purple-400 underline cursor-pointer hover:text-purple-700 dark:hover:text-purple-300' : ''}
              onClick={node.link ? (e) => {
                e.stopPropagation();
                openLink(node.link!);
              } : undefined}
            >
              {text}
            </span>
          </span>
        )}

        {/* Link icon (shown when node has a link) */}
        {node.link && !isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLinkPanel();
            }}
            className="ml-1 px-1 text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300"
            title={`Edit link: ${node.link}`}
          >
            <Link className="w-4 h-4" />
          </button>
        )}

        {/* Icon picker button (visible on hover when selected) */}
        {isSelected && !isEditing && (
          <button
            onClick={handleIconClick}
            className="ml-1 px-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Add icon (I)"
          >
            <Tags className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Children */}
      {!node.isCollapsed &&
        node.childIds
          .filter((childId) => !visibleNodes || visibleNodes.has(childId))
          .map((childId) => (
            <OutlineNode key={childId} nodeId={childId} depth={depth + 1} />
          ))}
    </div>
  );
}

export default OutlineNode;
