import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useDocumentStore } from '../../store';
import type { Node, NodeMap } from '../../types';
import { getIconDefinition } from '../../types';

// Editing state for overlay input
interface EditingState {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

// Drag state for node dragging
interface DragState {
  nodeId: string;
  startWorldX: number;
  startWorldY: number;
  currentWorldX: number;
  currentWorldY: number;
}

// Drop target state - where the dragged node will be inserted
interface DropTargetState {
  parentId: string;      // The parent node where the dragged node will be inserted
  insertIndex: number;   // The index in the parent's childIds where to insert
  indicatorY: number;    // Y position for the drop indicator (world coords)
  indicatorX: number;    // X position for the drop indicator (world coords)
}

// Node dimensions
const NODE_PADDING_X = 16;
const NODE_MIN_WIDTH = 80;
const NODE_HEIGHT = 32;
const NODE_RADIUS = 6;

// Layout constants
const HORIZONTAL_GAP = 60;
const VERTICAL_GAP = 20;

// Colors
const COLORS = {
  background: 0x1a1a2e,
  node: 0x16213e,
  nodeSelected: 0x0f3460,
  nodeMultiSelected: 0x0a2540, // Lighter selection for multi-selected nodes
  nodeBorder: 0x4a5568,
  nodeSelectedBorder: 0x63b3ed,
  nodeMultiSelectedBorder: 0x4299e1, // Slightly dimmer border for multi-selected
  text: 0xffffff,
  edge: 0x4a5568,
  collapseIndicator: 0x63b3ed,
  collapseIndicatorBg: 0x16213e,
};

interface NodeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Text measurement cache to avoid creating Text objects repeatedly
const textWidthCache = new Map<string, number>();

// Measure text width using PixiJS Text object
const measureTextWidth = (text: string): number => {
  if (textWidthCache.has(text)) {
    return textWidthCache.get(text)!;
  }

  const textStyle = new TextStyle({
    fontSize: 14,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });
  const textObj = new Text({ text: text || '(empty)', style: textStyle });
  const width = textObj.width;

  // Cache the result (limit cache size to prevent memory issues)
  if (textWidthCache.size > 1000) {
    textWidthCache.clear();
  }
  textWidthCache.set(text, width);

  // Clean up
  textObj.destroy();

  return width;
};

// Calculate tree layout
const calculateLayout = (
  nodes: NodeMap,
  rootId: string
): Map<string, NodeLayout> => {
  const layouts = new Map<string, NodeLayout>();

  // First pass: calculate node sizes using proper text measurement
  const getNodeWidth = (node: Node): number => {
    const text = node.content.type === 'text' ? node.content.text : '[image]';
    const textWidth = measureTextWidth(text);

    // Account for icons width
    let iconsWidth = 0;
    if (node.icons && node.icons.length > 0) {
      // Approximate width per icon emoji (12px font + 2px gap)
      iconsWidth = node.icons.length * 16 + 4;
    }

    return Math.max(textWidth + iconsWidth + NODE_PADDING_X * 2, NODE_MIN_WIDTH);
  };

  // Calculate subtree height
  const getSubtreeHeight = (nodeId: string): number => {
    const node = nodes[nodeId];
    if (!node) return 0;

    if (node.isCollapsed || node.childIds.length === 0) {
      return NODE_HEIGHT;
    }

    let totalHeight = 0;
    for (const childId of node.childIds) {
      totalHeight += getSubtreeHeight(childId);
    }
    totalHeight += (node.childIds.length - 1) * VERTICAL_GAP;

    return Math.max(totalHeight, NODE_HEIGHT);
  };

  // Layout nodes recursively
  const layoutNode = (nodeId: string, x: number, y: number): void => {
    const node = nodes[nodeId];
    if (!node) return;

    const width = getNodeWidth(node);
    const height = NODE_HEIGHT;

    layouts.set(nodeId, { x, y, width, height });

    if (node.isCollapsed || node.childIds.length === 0) {
      return;
    }

    // Calculate starting Y for children
    const subtreeHeight = getSubtreeHeight(nodeId);
    let childY = y - subtreeHeight / 2 + NODE_HEIGHT / 2;

    for (const childId of node.childIds) {
      const childSubtreeHeight = getSubtreeHeight(childId);
      const childCenterY = childY + childSubtreeHeight / 2 - NODE_HEIGHT / 2;

      layoutNode(childId, x + width + HORIZONTAL_GAP, childCenterY);

      childY += childSubtreeHeight + VERTICAL_GAP;
    }
  };

  // Start layout from root at center
  layoutNode(rootId, 100, 300);

  return layouts;
};

function MindMapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const nodesContainerRef = useRef<Container | null>(null);
  const edgesContainerRef = useRef<Container | null>(null);
  const dropIndicatorRef = useRef<Graphics | null>(null);
  const dragGhostRef = useRef<Container | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const layoutsRef = useRef<Map<string, NodeLayout>>(new Map());
  // Track click times per node for double-click detection (persists across re-renders)
  const clickTimesRef = useRef<Map<string, number>>(new Map());
  // Track IME composition state for Japanese input
  const isComposingRef = useRef(false);
  // Drag state for node dragging
  const dragStateRef = useRef<DragState | null>(null);
  const dropTargetRef = useRef<DropTargetState | null>(null);

  const nodes = useDocumentStore((state) => state.nodes);
  const rootId = useDocumentStore((state) => state.rootId);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const selectedNodeIds = useDocumentStore((state) => state.selectedNodeIds);
  const selectNode = useDocumentStore((state) => state.selectNode);
  const toggleNodeSelection = useDocumentStore((state) => state.toggleNodeSelection);
  const selectNodeRange = useDocumentStore((state) => state.selectNodeRange);
  const updateNodeText = useDocumentStore((state) => state.updateNodeText);
  const createChildNode = useDocumentStore((state) => state.createChildNode);
  const createSiblingNode = useDocumentStore((state) => state.createSiblingNode);
  const toggleCollapse = useDocumentStore((state) => state.toggleCollapse);
  const stopEditing = useDocumentStore((state) => state.stopEditing);
  const moveNode = useDocumentStore((state) => state.moveNode);
  const openIconPicker = useDocumentStore((state) => state.openIconPicker);
  const cycleIcon = useDocumentStore((state) => state.cycleIcon);

  // Check if ancestorId is an ancestor of descendantId
  const isAncestor = useCallback((ancestorId: string, descendantId: string): boolean => {
    let currentId: string | null = descendantId;
    while (currentId) {
      if (currentId === ancestorId) return true;
      currentId = nodes[currentId]?.parentId ?? null;
    }
    return false;
  }, [nodes]);

  // Update drop indicator graphics
  const updateDropIndicator = useCallback((dropTarget: DropTargetState | null) => {
    const app = appRef.current;
    if (!app) return;

    // Remove existing indicator
    if (dropIndicatorRef.current) {
      dropIndicatorRef.current.destroy();
      dropIndicatorRef.current = null;
    }

    if (!dropTarget) return;

    // Create new indicator
    const indicator = new Graphics();
    const targetLayout = layoutsRef.current.get(dropTarget.parentId);
    if (!targetLayout) return;

    // Draw a horizontal line at the drop position
    const lineX = dropTarget.indicatorX;
    const lineY = dropTarget.indicatorY;
    const lineWidth = 100;

    indicator.moveTo(lineX, lineY);
    indicator.lineTo(lineX + lineWidth, lineY);
    indicator.stroke({ width: 3, color: 0x63b3ed });

    // Add a small circle at the start
    indicator.circle(lineX, lineY, 4);
    indicator.fill(0x63b3ed);

    app.stage.addChild(indicator);
    dropIndicatorRef.current = indicator;
  }, []);

  // Update drag ghost position
  const updateDragGhost = useCallback((dragState: DragState | null) => {
    const app = appRef.current;
    if (!app) return;

    // Remove existing ghost
    if (dragGhostRef.current) {
      dragGhostRef.current.destroy();
      dragGhostRef.current = null;
    }

    if (!dragState) return;

    const node = nodes[dragState.nodeId];
    const layout = layoutsRef.current.get(dragState.nodeId);
    if (!node || !layout) return;

    // Create ghost container
    const ghost = new Container();
    ghost.alpha = 0.6;
    ghost.x = dragState.currentWorldX - layout.width / 2;
    ghost.y = dragState.currentWorldY - layout.height / 2;

    // Draw ghost node
    const bg = new Graphics();
    bg.roundRect(0, 0, layout.width, layout.height, NODE_RADIUS);
    bg.fill(COLORS.nodeSelected);
    bg.stroke({ width: 2, color: COLORS.nodeSelectedBorder });
    ghost.addChild(bg);

    // Ghost text
    const text = node.content.type === 'text' ? node.content.text : '[image]';
    const textStyle = new TextStyle({
      fontSize: 14,
      fill: COLORS.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    });
    const textObj = new Text({ text: text || '(empty)', style: textStyle });
    textObj.x = NODE_PADDING_X;
    textObj.y = (layout.height - textObj.height) / 2;
    ghost.addChild(textObj);

    app.stage.addChild(ghost);
    dragGhostRef.current = ghost;
  }, [nodes]);

  // Calculate drop target based on current drag position
  const calculateDropTarget = useCallback((worldX: number, worldY: number, draggedNodeId: string): DropTargetState | null => {
    const layouts = layoutsRef.current;

    // Find the closest node to the cursor using array iteration
    const entries = Array.from(layouts.entries());
    let closestId: string | null = null;
    let closestDistance = Infinity;
    let closestLayout: NodeLayout | null = null;

    for (const [nodeId, layout] of entries) {
      // Skip the dragged node and its descendants
      if (nodeId === draggedNodeId || isAncestor(draggedNodeId, nodeId)) continue;

      // Skip root node (can't reorder around root)
      if (!nodes[nodeId]?.parentId) continue;

      const nodeCenterX = layout.x + layout.width / 2;
      const nodeCenterY = layout.y + layout.height / 2;
      const distance = Math.sqrt(
        Math.pow(worldX - nodeCenterX, 2) + Math.pow(worldY - nodeCenterY, 2)
      );

      if (distance < closestDistance) {
        closestId = nodeId;
        closestDistance = distance;
        closestLayout = layout;
      }
    }

    if (!closestId || !closestLayout || closestDistance > 150) return null;

    const targetNode = nodes[closestId];
    if (!targetNode || !targetNode.parentId) return null;

    const layout = closestLayout;
    const targetId = closestId;
    const relativeY = worldY - layout.y;
    const nodeHeight = layout.height;
    const third = nodeHeight / 3;

    let parentId: string;
    let insertIndex: number;
    let indicatorY: number;
    let indicatorX: number;

    if (relativeY < third) {
      // Top third: insert before this node (as sibling)
      parentId = targetNode.parentId;
      const parent = nodes[parentId];
      insertIndex = parent?.childIds.indexOf(targetId) ?? 0;
      indicatorY = layout.y;
      indicatorX = layout.x;
    } else if (relativeY > nodeHeight - third) {
      // Bottom third: insert after this node
      if (!targetNode.isCollapsed && targetNode.childIds.length > 0) {
        // Insert as first child
        parentId = targetId;
        insertIndex = 0;
        indicatorY = layout.y + layout.height + VERTICAL_GAP / 2;
        indicatorX = layout.x + HORIZONTAL_GAP;
      } else {
        // Insert as sibling after this node
        parentId = targetNode.parentId;
        const parent = nodes[parentId];
        insertIndex = (parent?.childIds.indexOf(targetId) ?? 0) + 1;
        indicatorY = layout.y + layout.height;
        indicatorX = layout.x;
      }
    } else {
      // Middle third: insert as child of this node
      parentId = targetId;
      insertIndex = targetNode.childIds.length;
      indicatorY = layout.y + layout.height / 2;
      indicatorX = layout.x + layout.width + HORIZONTAL_GAP / 2;
    }

    return { parentId, insertIndex, indicatorY, indicatorX };
  }, [nodes, isAncestor]);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    const initApp = async () => {
      const app = new Application();
      await app.init({
        background: COLORS.background,
        resizeTo: containerRef.current!,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (!mounted) {
        app.destroy(true);
        return;
      }

      containerRef.current!.appendChild(app.canvas);

      // Create containers for edges and nodes (edges behind nodes)
      const edgesContainer = new Container();
      const nodesContainer = new Container();
      app.stage.addChild(edgesContainer);
      app.stage.addChild(nodesContainer);

      appRef.current = app;
      nodesContainerRef.current = nodesContainer;
      edgesContainerRef.current = edgesContainer;

      // Enable pan
      let isDragging = false;
      let dragStart = { x: 0, y: 0 };
      let stageStart = { x: 0, y: 0 };

      // Prevent the native context menu so right-drag can be used for panning.
      app.canvas.addEventListener('contextmenu', (e: MouseEvent) => {
        e.preventDefault();
      });

      app.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
        // Only start panning if not dragging a node and using left, middle, or right button
        if ((e.button === 0 || e.button === 1 || e.button === 2) && !potentialDragRef.current) {
          // Avoid browser defaults (e.g. right-click menu) interfering with drag
          e.preventDefault();
          isDragging = true;
          isPanningRef.current = true;
          app.canvas.style.cursor = 'grabbing';
          dragStart = { x: e.clientX, y: e.clientY };
          stageStart = { x: app.stage.x, y: app.stage.y };
        }
      });

      app.canvas.addEventListener('pointermove', (e: PointerEvent) => {
        // Only pan if we're in panning mode and not dragging a node
        if (isDragging && !isDraggingNodeRef.current && !potentialDragRef.current) {
          e.preventDefault();
          const dx = e.clientX - dragStart.x;
          const dy = e.clientY - dragStart.y;
          app.stage.x = stageStart.x + dx;
          app.stage.y = stageStart.y + dy;
        }
      });

      app.canvas.addEventListener('pointerup', () => {
        isDragging = false;
        isPanningRef.current = false;
        app.canvas.style.cursor = '';
      });

      app.canvas.addEventListener('pointerleave', () => {
        isDragging = false;
        isPanningRef.current = false;
        app.canvas.style.cursor = '';
      });

      // Enable zoom
      app.canvas.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = app.stage.scale.x * scaleFactor;

        // Limit zoom
        if (newScale < 0.2 || newScale > 3) return;

        // Zoom toward mouse position
        const rect = app.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - app.stage.x) / app.stage.scale.x;
        const worldY = (mouseY - app.stage.y) / app.stage.scale.y;

        app.stage.scale.set(newScale);

        app.stage.x = mouseX - worldX * newScale;
        app.stage.y = mouseY - worldY * newScale;
      });

      // Mark as ready to trigger render
      setIsReady(true);
    };

    initApp();

    return () => {
      mounted = false;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      setIsReady(false);
    };
  }, []);

  // Start editing a node in-place
  const startEditingNode = useCallback((nodeId: string, retryCount = 0) => {
    // Get fresh state from the store (important for newly created nodes)
    const currentNodes = useDocumentStore.getState().nodes;
    const node = currentNodes[nodeId];
    const layout = layoutsRef.current.get(nodeId);

    if (!node || !layout) {
      // Retry a few times for newly created nodes (state may not be ready yet)
      if (retryCount < 5) {
        setTimeout(() => startEditingNode(nodeId, retryCount + 1), 50);
      }
      return;
    }

    const app = appRef.current;
    if (!app) return;

    // Calculate screen position based on stage transform
    const screenX = layout.x * app.stage.scale.x + app.stage.x;
    const screenY = layout.y * app.stage.scale.y + app.stage.y;
    const screenWidth = layout.width * app.stage.scale.x;
    const screenHeight = layout.height * app.stage.scale.y;

    const text = node.content.type === 'text' ? node.content.text : '';

    setEditing({
      nodeId,
      x: screenX,
      y: screenY,
      width: screenWidth,
      height: screenHeight,
      text,
    });

    selectNode(nodeId);
  }, [selectNode]);

  // Handle editing input changes
  const handleEditChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditing(prev => prev ? { ...prev, text: e.target.value } : null);
  }, []);

  // Handle editing keyboard events
  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!editing) return;

    // Ignore all keys during IME composition (e.g., Japanese input)
    // During IME composition, keyCode is 229 or key is 'Process'
    if (e.nativeEvent.isComposing || isComposingRef.current || e.keyCode === 229 || e.key === 'Process') {
      return; // Let IME handle the key
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      // Save the current text
      updateNodeText(editing.nodeId, editing.text);

      // Create sibling if not root
      const node = nodes[editing.nodeId];
      if (node?.parentId) {
        createSiblingNode(editing.nodeId);
        // After creating sibling, start editing the new node
        // The new node will be selected, we need to wait for the state update
        setEditing(null);
        // Use setTimeout to let the state update, then start editing the new selected node
        setTimeout(() => {
          const newSelectedId = useDocumentStore.getState().selectedNodeId;
          if (newSelectedId && newSelectedId !== editing.nodeId) {
            startEditingNode(newSelectedId);
          }
        }, 0);
      } else {
        setEditing(null);
        stopEditing();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Save the current text
      updateNodeText(editing.nodeId, editing.text);
      // Create child node
      createChildNode(editing.nodeId);
      setEditing(null);
      // Start editing the new child
      setTimeout(() => {
        const newSelectedId = useDocumentStore.getState().selectedNodeId;
        if (newSelectedId && newSelectedId !== editing.nodeId) {
          startEditingNode(newSelectedId);
        }
      }, 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (e.ctrlKey) {
        // Ctrl+Escape: Cancel editing (don't save)
        setEditing(null);
        stopEditing();
      } else {
        // Escape: Save and exit editing mode
        updateNodeText(editing.nodeId, editing.text);
        setEditing(null);
        stopEditing();
      }
    }
  }, [editing, nodes, updateNodeText, createSiblingNode, createChildNode, startEditingNode, stopEditing]);

  // Handle IME composition events
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
  }, []);

  // Track when editing started to prevent immediate blur
  const editingStartTimeRef = useRef<number>(0);

  // Handle blur - save on blur (but not if editing just started)
  const handleEditBlur = useCallback(() => {
    if (editing) {
      // Prevent blur if editing just started (within 100ms)
      const timeSinceStart = Date.now() - editingStartTimeRef.current;
      if (timeSinceStart < 100) {
        // Re-focus the input
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
        return;
      }
      updateNodeText(editing.nodeId, editing.text);
      setEditing(null);
      stopEditing();
    }
  }, [editing, updateNodeText, stopEditing]);

  // Track the nodeId being edited to detect when we start editing a NEW node
  const editingNodeIdRef = useRef<string | null>(null);

  // Track potential drag start for nodes
  const potentialDragRef = useRef<{
    nodeId: string;
    startScreenX: number;
    startScreenY: number;
    startWorldX: number;
    startWorldY: number;
  } | null>(null);
  const isDraggingNodeRef = useRef(false);
  // Track canvas panning state (for coordination with node dragging)
  const isPanningRef = useRef(false);

  // Focus input when editing starts (only on initial edit, not on text changes)
  useEffect(() => {
    if (editing && inputRef.current) {
      // Only focus and select if we started editing a different node
      if (editingNodeIdRef.current !== editing.nodeId) {
        editingStartTimeRef.current = Date.now();
        editingNodeIdRef.current = editing.nodeId;
        inputRef.current.focus();
        inputRef.current.select();
      }
    } else {
      editingNodeIdRef.current = null;
    }
  }, [editing]);

  // Handle node dragging with document-level event listeners
  useEffect(() => {
    const DRAG_THRESHOLD = 5; // Pixels to move before starting drag

    const handlePointerMove = (e: PointerEvent) => {
      const app = appRef.current;
      if (!app || !potentialDragRef.current) return;

      const { nodeId, startScreenX, startScreenY } = potentialDragRef.current;

      // Check if we've moved beyond the threshold to start dragging
      const dx = e.clientX - startScreenX;
      const dy = e.clientY - startScreenY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!isDraggingNodeRef.current && distance >= DRAG_THRESHOLD) {
        // Start dragging - check if this is a non-root node
        const node = nodes[nodeId];
        if (!node || !node.parentId) {
          // Can't drag root node
          potentialDragRef.current = null;
          return;
        }
        isDraggingNodeRef.current = true;
      }

      if (isDraggingNodeRef.current) {
        // Convert screen position to world position
        const rect = app.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = (screenX - app.stage.x) / app.stage.scale.x;
        const worldY = (screenY - app.stage.y) / app.stage.scale.y;

        // Update drag state
        const dragState: DragState = {
          nodeId,
          startWorldX: potentialDragRef.current.startWorldX,
          startWorldY: potentialDragRef.current.startWorldY,
          currentWorldX: worldX,
          currentWorldY: worldY,
        };
        dragStateRef.current = dragState;

        // Calculate and update drop target
        const dropTarget = calculateDropTarget(worldX, worldY, nodeId);
        dropTargetRef.current = dropTarget;

        // Update visual feedback
        updateDragGhost(dragState);
        updateDropIndicator(dropTarget);
      }
    };

    const handlePointerUp = () => {
      if (isDraggingNodeRef.current && dragStateRef.current && dropTargetRef.current) {
        // Execute the move
        moveNode(
          dragStateRef.current.nodeId,
          dropTargetRef.current.parentId,
          dropTargetRef.current.insertIndex
        );
      }

      // Clean up drag state
      potentialDragRef.current = null;
      isDraggingNodeRef.current = false;
      dragStateRef.current = null;
      dropTargetRef.current = null;

      // Clean up visual feedback
      updateDragGhost(null);
      updateDropIndicator(null);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [nodes, calculateDropTarget, updateDragGhost, updateDropIndicator, moveNode]);

  // Render nodes and edges
  const render = useCallback(() => {
    const nodesContainer = nodesContainerRef.current;
    const edgesContainer = edgesContainerRef.current;
    if (!nodesContainer || !edgesContainer) return;

    // Clear previous render
    nodesContainer.removeChildren();
    edgesContainer.removeChildren();

    // Calculate layout and store in ref for editing overlay positioning
    const layouts = calculateLayout(nodes, rootId);
    layoutsRef.current = layouts;

    // Draw edges first
    const drawEdges = (nodeId: string) => {
      const node = nodes[nodeId];
      if (!node || node.isCollapsed) return;

      const parentLayout = layouts.get(nodeId);
      if (!parentLayout) return;

      for (const childId of node.childIds) {
        const childLayout = layouts.get(childId);
        if (!childLayout) continue;

        const graphics = new Graphics();
        graphics.moveTo(
          parentLayout.x + parentLayout.width,
          parentLayout.y + parentLayout.height / 2
        );

        // Bezier curve for smooth edge
        const midX =
          parentLayout.x +
          parentLayout.width +
          (childLayout.x - parentLayout.x - parentLayout.width) / 2;

        graphics.bezierCurveTo(
          midX,
          parentLayout.y + parentLayout.height / 2,
          midX,
          childLayout.y + childLayout.height / 2,
          childLayout.x,
          childLayout.y + childLayout.height / 2
        );

        graphics.stroke({ width: 2, color: COLORS.edge });
        edgesContainer.addChild(graphics);

        drawEdges(childId);
      }
    };

    drawEdges(rootId);

    // Draw nodes
    const drawNodes = (nodeId: string) => {
      const node = nodes[nodeId];
      if (!node) return;

      const layout = layouts.get(nodeId);
      if (!layout) return;

      const isPrimarySelected = nodeId === selectedNodeId;
      const isMultiSelected = selectedNodeIds.includes(nodeId);
      const container = new Container();
      container.x = layout.x;
      container.y = layout.y;
      container.eventMode = 'static';
      container.cursor = 'pointer';

      // Node background - different styles for primary vs multi-selected
      const bg = new Graphics();
      bg.roundRect(0, 0, layout.width, layout.height, NODE_RADIUS);
      bg.fill(
        isPrimarySelected
          ? COLORS.nodeSelected
          : isMultiSelected
          ? COLORS.nodeMultiSelected
          : COLORS.node
      );
      bg.stroke({
        width: 2,
        color: isPrimarySelected
          ? COLORS.nodeSelectedBorder
          : isMultiSelected
          ? COLORS.nodeMultiSelectedBorder
          : COLORS.nodeBorder,
      });
      container.addChild(bg);

      // Node icons
      const nodeIcons = node.icons || [];
      let iconOffset = NODE_PADDING_X;
      const ICON_SIZE = 14;

      if (nodeIcons.length > 0) {
        nodeIcons.forEach((icon, iconIndex) => {
          const def = getIconDefinition(icon);
          if (!def) return;

          const iconColor = parseInt(def.color?.replace('#', '') || '6b7280', 16);
          const iconY = (layout.height - ICON_SIZE) / 2;

          // Create a container for the icon to handle clicks
          const iconContainer = new Container();
          iconContainer.x = iconOffset;
          iconContainer.y = iconY;
          iconContainer.eventMode = 'static';
          iconContainer.cursor = 'pointer';

          // Add click handler to cycle icon
          iconContainer.on('pointerdown', (e) => {
            const originalEvent = e.nativeEvent as PointerEvent | undefined;
            if (originalEvent?.button === 2) return;
            e.stopPropagation();
            cycleIcon(nodeId, iconIndex);
          });

          const iconGraphics = new Graphics();

          // Draw simple shapes based on icon type (positions relative to container)
          if (icon.type === 'priority') {
            // Circle with number
            iconGraphics.circle(ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE / 2 - 1);
            iconGraphics.fill(iconColor);
            // Add number text
            const numStyle = new TextStyle({
              fontSize: 9,
              fill: 0xffffff,
              fontWeight: 'bold',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            });
            const numText = new Text({ text: String(icon.value), style: numStyle });
            numText.x = (ICON_SIZE - numText.width) / 2;
            numText.y = (ICON_SIZE - numText.height) / 2;
            iconContainer.addChild(iconGraphics);
            iconContainer.addChild(numText);
          } else if (icon.type === 'task') {
            // Checkbox shapes
            const boxSize = ICON_SIZE - 2;
            const boxX = 1;
            const boxY = 1;
            iconGraphics.roundRect(boxX, boxY, boxSize, boxSize, 2);
            iconGraphics.stroke({ width: 1.5, color: iconColor });
            if (icon.value === 'done') {
              // Checkmark
              iconGraphics.moveTo(boxX + 3, boxY + boxSize / 2);
              iconGraphics.lineTo(boxX + boxSize / 2 - 1, boxY + boxSize - 3);
              iconGraphics.lineTo(boxX + boxSize - 3, boxY + 3);
              iconGraphics.stroke({ width: 2, color: iconColor });
            } else if (icon.value === 'half') {
              // Half fill
              iconGraphics.rect(boxX + 2, boxY + boxSize / 2, boxSize - 4, boxSize / 2 - 2);
              iconGraphics.fill(iconColor);
            } else if (icon.value === 'quarter') {
              // Quarter fill
              iconGraphics.rect(boxX + 2, boxY + boxSize * 0.75 - 2, boxSize - 4, boxSize * 0.25);
              iconGraphics.fill(iconColor);
            } else if (icon.value === 'three-quarter') {
              // Three quarter fill
              iconGraphics.rect(boxX + 2, boxY + boxSize * 0.25, boxSize - 4, boxSize * 0.75 - 2);
              iconGraphics.fill(iconColor);
            }
            iconContainer.addChild(iconGraphics);
          } else if (icon.type === 'flag') {
            // Flag shape
            iconGraphics.moveTo(2, 2);
            iconGraphics.lineTo(ICON_SIZE - 2, 2);
            iconGraphics.lineTo(ICON_SIZE - 4, ICON_SIZE / 2);
            iconGraphics.lineTo(ICON_SIZE - 2, ICON_SIZE - 4);
            iconGraphics.lineTo(2, ICON_SIZE - 4);
            iconGraphics.closePath();
            iconGraphics.fill(iconColor);
            iconContainer.addChild(iconGraphics);
          } else if (icon.type === 'symbol' && icon.value === 'star') {
            // Star shape
            const cx = ICON_SIZE / 2;
            const cy = ICON_SIZE / 2;
            const outerR = ICON_SIZE / 2 - 1;
            const innerR = outerR * 0.4;
            for (let i = 0; i < 5; i++) {
              const outerAngle = (i * 72 - 90) * Math.PI / 180;
              const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
              const outerX = cx + Math.cos(outerAngle) * outerR;
              const outerY = cy + Math.sin(outerAngle) * outerR;
              const innerX = cx + Math.cos(innerAngle) * innerR;
              const innerY = cy + Math.sin(innerAngle) * innerR;
              if (i === 0) {
                iconGraphics.moveTo(outerX, outerY);
              } else {
                iconGraphics.lineTo(outerX, outerY);
              }
              iconGraphics.lineTo(innerX, innerY);
            }
            iconGraphics.closePath();
            iconGraphics.fill(iconColor);
            iconContainer.addChild(iconGraphics);
          } else {
            // Default: simple colored circle for other icons
            iconGraphics.circle(ICON_SIZE / 2, ICON_SIZE / 2, ICON_SIZE / 2 - 2);
            iconGraphics.fill(iconColor);
            iconContainer.addChild(iconGraphics);
          }

          container.addChild(iconContainer);
          iconOffset += ICON_SIZE + 3;
        });
        iconOffset += 2; // Extra space after icons
      }

      // Node text
      const text = node.content.type === 'text' ? node.content.text : '[image]';
      const textStyle = new TextStyle({
        fontSize: 14,
        fill: COLORS.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      });
      const textObj = new Text({ text: text || '(empty)', style: textStyle });
      textObj.x = iconOffset;
      textObj.y = (layout.height - textObj.height) / 2;
      container.addChild(textObj);

      // Collapse/expand indicator for nodes with children
      if (node.childIds.length > 0) {
        const indicatorRadius = 8;
        const indicatorX = layout.width + indicatorRadius + 4;
        const indicatorY = layout.height / 2;

        // Create a container for the indicator to handle clicks separately
        const indicatorContainer = new Container();
        indicatorContainer.x = indicatorX;
        indicatorContainer.y = indicatorY;
        indicatorContainer.eventMode = 'static';
        indicatorContainer.cursor = 'pointer';

        const indicator = new Graphics();

        // Circle background (centered at 0,0 since container is positioned)
        indicator.circle(0, 0, indicatorRadius);
        indicator.fill(COLORS.collapseIndicatorBg);
        indicator.stroke({ width: 1.5, color: COLORS.collapseIndicator });

        const iconSize = 5;
        if (node.isCollapsed) {
          // Plus sign for collapsed nodes
          // Horizontal line
          indicator.moveTo(-iconSize, 0);
          indicator.lineTo(iconSize, 0);
          indicator.stroke({ width: 2, color: COLORS.collapseIndicator });
          // Vertical line
          indicator.moveTo(0, -iconSize);
          indicator.lineTo(0, iconSize);
          indicator.stroke({ width: 2, color: COLORS.collapseIndicator });
        } else {
          // Minus sign for expanded nodes
          // Horizontal line only
          indicator.moveTo(-iconSize, 0);
          indicator.lineTo(iconSize, 0);
          indicator.stroke({ width: 2, color: COLORS.collapseIndicator });
        }

        indicatorContainer.addChild(indicator);

        // Click handler to toggle collapse/expand
        indicatorContainer.on('pointerdown', (e) => {
          const originalEvent = e.nativeEvent as PointerEvent | undefined;
          if (originalEvent?.button === 2) return;
          e.stopPropagation();
          toggleCollapse(nodeId);
        });

        container.addChild(indicatorContainer);
      }

      // Click handler with double-click detection and drag initiation
      container.on('pointerdown', (e) => {
        const originalEvent = e.nativeEvent as PointerEvent | undefined;
        if (originalEvent?.button === 2) {
          // Let right-click/drag bubble to the canvas to pan.
          return;
        }

        e.stopPropagation();
        const now = Date.now();
        const lastClickTime = clickTimesRef.current.get(nodeId) || 0;
        const timeDiff = now - lastClickTime;

        // Get keyboard modifiers from the original event
        const ctrlKey = originalEvent?.ctrlKey || originalEvent?.metaKey || false;
        const shiftKey = originalEvent?.shiftKey || false;

        if (timeDiff < 300 && timeDiff > 0 && !ctrlKey && !shiftKey) {
          // Double-click: start in-place editing (only without modifiers)
          startEditingNode(nodeId);
          clickTimesRef.current.set(nodeId, 0); // Reset to prevent triple-click
          potentialDragRef.current = null; // Cancel any potential drag
        } else {
          // Single click: handle selection based on modifiers
          if (ctrlKey) {
            // Ctrl+click: toggle node in multi-selection
            toggleNodeSelection(nodeId);
          } else if (shiftKey) {
            // Shift+click: select range
            selectNodeRange(nodeId);
          } else {
            // Normal click: single selection
            selectNode(nodeId);
          }
          clickTimesRef.current.set(nodeId, now);

          // Set up potential drag (only for non-root nodes)
          const app = appRef.current;
          if (app && node.parentId) {
            const rect = app.canvas.getBoundingClientRect();
            const screenX = (e as unknown as PointerEvent).clientX ?? e.global.x + rect.left;
            const screenY = (e as unknown as PointerEvent).clientY ?? e.global.y + rect.top;
            const worldX = (screenX - rect.left - app.stage.x) / app.stage.scale.x;
            const worldY = (screenY - rect.top - app.stage.y) / app.stage.scale.y;

            potentialDragRef.current = {
              nodeId,
              startScreenX: screenX,
              startScreenY: screenY,
              startWorldX: worldX,
              startWorldY: worldY,
            };
          }
        }
      });

      nodesContainer.addChild(container);

      // Draw children if not collapsed
      if (!node.isCollapsed) {
        for (const childId of node.childIds) {
          drawNodes(childId);
        }
      }
    };

    drawNodes(rootId);
  }, [nodes, rootId, selectedNodeId, selectedNodeIds, selectNode, toggleNodeSelection, selectNodeRange, startEditingNode, toggleCollapse]);

  // Re-render when data changes or app becomes ready
  useEffect(() => {
    if (isReady) {
      render();
    }
  }, [isReady, render]);

  // Handle keyboard events when canvas wrapper is focused (not editing)
  const handleWrapperKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // If we're editing, let the input handle it
    if (editing) return;

    // Only handle keys when we have a selected node
    if (!selectedNodeId) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      // Create child node
      createChildNode(selectedNodeId);
      // Start editing the new node after state update
      setTimeout(() => {
        const newSelectedId = useDocumentStore.getState().selectedNodeId;
        if (newSelectedId && newSelectedId !== selectedNodeId) {
          startEditingNode(newSelectedId);
        }
      }, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Create sibling node (only if not root)
      const node = nodes[selectedNodeId];
      if (node?.parentId) {
        createSiblingNode(selectedNodeId);
        // Start editing the new node after state update
        setTimeout(() => {
          const newSelectedId = useDocumentStore.getState().selectedNodeId;
          if (newSelectedId && newSelectedId !== selectedNodeId) {
            startEditingNode(newSelectedId);
          }
        }, 0);
      }
    } else if (e.key === 'e' || e.key === 'E' || e.key === 'F2') {
      e.preventDefault();
      e.stopPropagation();
      // Start editing the selected node
      startEditingNode(selectedNodeId);
    } else if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      e.stopPropagation();
      // Open icon picker (uses currently selected node)
      openIconPicker();
    }
  }, [editing, selectedNodeId, nodes, createChildNode, createSiblingNode, startEditingNode, openIconPicker]);

  // Focus the wrapper when canvas is clicked (to receive keyboard events)
  const handleWrapperClick = useCallback(() => {
    if (!editing) {
      wrapperRef.current?.focus();
    }
  }, [editing]);

  // Focus wrapper when PixiJS is ready or when editing ends to ensure keyboard events work
  useEffect(() => {
    if (isReady && wrapperRef.current && !editing) {
      // Use setTimeout to ensure the input is fully unmounted before focusing wrapper
      setTimeout(() => {
        wrapperRef.current?.focus();
      }, 0);
    }
  }, [isReady, editing]);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full outline-none"
      tabIndex={0}
      onKeyDown={handleWrapperKeyDown}
      onClick={handleWrapperClick}
    >
      {/* PixiJS Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab"
        style={{ touchAction: 'none' }}
      />

      {/* Editing overlay */}
      {editing && (
        <input
          ref={inputRef}
          type="text"
          value={editing.text}
          onChange={handleEditChange}
          onKeyDown={handleEditKeyDown}
          onBlur={handleEditBlur}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          className="absolute bg-[#16213e] text-white border-2 border-blue-400 rounded px-2 outline-none"
          style={{
            left: editing.x,
            top: editing.y,
            width: Math.max(editing.width, 100),
            height: editing.height,
            fontSize: `${14 * (appRef.current?.stage.scale.x || 1)}px`,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        />
      )}
    </div>
  );
}

export default MindMapCanvas;
