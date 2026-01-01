import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useDocumentStore } from '../../store';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useFileOperations } from '../../hooks/useFileOperations';
import OutlineNode from './OutlineNode';

// Drag context for sharing drag state between nodes
export interface DropTarget {
  parentId: string;      // The parent node where the dragged node will be inserted
  insertIndex: number;   // The index in the parent's childIds where to insert
  depth: number;         // Visual depth for the drop indicator
  indicatorY: number;    // Y position for the drop indicator line
}

interface DragContextType {
  draggedNodeId: string | null;
  dropTarget: DropTarget | null;
  startDrag: (nodeId: string) => void;
  endDrag: () => void;
  setDropTarget: (target: DropTarget | null) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const DragContext = createContext<DragContextType | null>(null);

export const useDragContext = () => {
  const context = useContext(DragContext);
  if (!context) {
    throw new Error('useDragContext must be used within OutlineView');
  }
  return context;
};

function OutlineView() {
  const rootId = useDocumentStore((state) => state.rootId);
  const nodes = useDocumentStore((state) => state.nodes);
  const moveNode = useDocumentStore((state) => state.moveNode);

  // Drag state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((nodeId: string) => {
    // Clear any text selection to prevent blue highlight during drag
    window.getSelection()?.removeAllRanges();
    setDraggedNodeId(nodeId);
  }, []);

  const endDrag = useCallback(() => {
    // Execute the move if we have a valid drop target
    if (draggedNodeId && dropTarget) {
      moveNode(draggedNodeId, dropTarget.parentId, dropTarget.insertIndex);
    }
    setDraggedNodeId(null);
    setDropTarget(null);
  }, [draggedNodeId, dropTarget, moveNode]);

  // Handle mouse move during drag
  useEffect(() => {
    if (!draggedNodeId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const scrollTop = containerRef.current.scrollTop;

      // Check if mouse is within the container bounds
      if (
        e.clientX < containerRect.left ||
        e.clientX > containerRect.right ||
        e.clientY < containerRect.top ||
        e.clientY > containerRect.bottom
      ) {
        setDropTarget(null);
        return;
      }

      // Find the node element under the mouse
      const nodeElements = containerRef.current.querySelectorAll('[data-node-id]');
      let closestNode: Element | null = null;
      let closestDistance = Infinity;

      nodeElements.forEach((el) => {
        const nodeId = el.getAttribute('data-node-id');
        if (nodeId === draggedNodeId) return; // Skip the dragged node

        const rect = el.getBoundingClientRect();
        const nodeCenter = rect.top + rect.height / 2;
        const distance = Math.abs(e.clientY - nodeCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestNode = el;
        }
      });

      if (!closestNode) {
        setDropTarget(null);
        return;
      }

      const targetNodeId = (closestNode as Element).getAttribute('data-node-id');
      if (!targetNodeId) return;

      const targetNode = nodes[targetNodeId];
      if (!targetNode) return;

      // Check if dragged node is an ancestor of target
      const isAncestor = (ancestorId: string, descendantId: string): boolean => {
        let currentId: string | null = descendantId;
        while (currentId) {
          if (currentId === ancestorId) return true;
          currentId = nodes[currentId]?.parentId ?? null;
        }
        return false;
      };

      if (isAncestor(draggedNodeId, targetNodeId)) {
        setDropTarget(null);
        return;
      }

      const rect = (closestNode as Element).getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const nodeHeight = rect.height;
      const third = nodeHeight / 3;
      const depth = parseInt((closestNode as Element).getAttribute('data-depth') || '0', 10);

      let targetParentId: string;
      let insertIndex: number;
      let indicatorDepth: number;
      let indicatorY: number;

      // For root node, skip - we don't show an indicator when hovering over root
      // (nodes can only be dropped as children of other nodes, not reordered around root)
      if (!targetNode.parentId) {
        setDropTarget(null);
        return;
      }

      if (relativeY < third) {
        // Top third: insert before this node (as sibling)
        targetParentId = targetNode.parentId;
        const parent = nodes[targetParentId];
        insertIndex = parent?.childIds.indexOf(targetNodeId) ?? 0;
        indicatorDepth = depth;
        indicatorY = rect.top - containerRect.top + scrollTop;
      } else if (relativeY > nodeHeight - third) {
        // Bottom third: insert after this node
        if (!targetNode.isCollapsed && targetNode.childIds.length > 0) {
          // Insert as first child
          targetParentId = targetNodeId;
          insertIndex = 0;
          indicatorDepth = depth + 1;
          indicatorY = rect.bottom - containerRect.top + scrollTop;
        } else {
          // Insert as sibling after this node
          targetParentId = targetNode.parentId;
          const parent = nodes[targetParentId];
          insertIndex = (parent?.childIds.indexOf(targetNodeId) ?? 0) + 1;
          indicatorDepth = depth;
          indicatorY = rect.bottom - containerRect.top + scrollTop;
        }
      } else {
        // Middle third: insert as child of this node
        targetParentId = targetNodeId;
        insertIndex = targetNode.childIds.length;
        indicatorDepth = depth + 1;
        indicatorY = rect.bottom - containerRect.top + scrollTop;
      }

      setDropTarget({
        parentId: targetParentId,
        insertIndex,
        depth: indicatorDepth,
        indicatorY,
      });
    };

    const handleMouseUp = () => {
      endDrag();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedNodeId, nodes, endDrag]);

  const dragContextValue: DragContextType = {
    draggedNodeId,
    dropTarget,
    startDrag,
    endDrag,
    setDropTarget,
    containerRef,
  };

  // Enable keyboard navigation
  useKeyboardNavigation();

  // Enable file operations (Ctrl+S, Ctrl+O, Ctrl+N)
  useFileOperations();

  return (
    <DragContext.Provider value={dragContextValue}>
      <div className="h-full flex flex-col">
        {/* Content */}
        <div
          ref={containerRef}
          className={`flex-1 overflow-auto p-4 relative ${draggedNodeId ? 'select-none' : ''}`}
        >
          <OutlineNode nodeId={rootId} depth={0} />

          {/* Drop indicator line */}
          {dropTarget && (
            <div
              className="absolute h-0.5 bg-blue-500 pointer-events-none z-10"
              style={{
                top: `${dropTarget.indicatorY}px`,
                left: `${dropTarget.depth * 24 + 16}px`,
                right: '16px',
              }}
            />
          )}
        </div>
      </div>
    </DragContext.Provider>
  );
}

export default OutlineView;
