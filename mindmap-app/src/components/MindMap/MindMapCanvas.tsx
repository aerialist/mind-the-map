import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useDocumentStore } from '../../store';
import type { Node, NodeMap } from '../../types';

// Editing state for overlay input
interface EditingState {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
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
  nodeBorder: 0x4a5568,
  nodeSelectedBorder: 0x63b3ed,
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
    return Math.max(textWidth + NODE_PADDING_X * 2, NODE_MIN_WIDTH);
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const layoutsRef = useRef<Map<string, NodeLayout>>(new Map());
  // Track click times per node for double-click detection (persists across re-renders)
  const clickTimesRef = useRef<Map<string, number>>(new Map());
  // Track IME composition state for Japanese input
  const isComposingRef = useRef(false);

  const nodes = useDocumentStore((state) => state.nodes);
  const rootId = useDocumentStore((state) => state.rootId);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const selectNode = useDocumentStore((state) => state.selectNode);
  const updateNodeText = useDocumentStore((state) => state.updateNodeText);
  const createChildNode = useDocumentStore((state) => state.createChildNode);
  const createSiblingNode = useDocumentStore((state) => state.createSiblingNode);
  const toggleCollapse = useDocumentStore((state) => state.toggleCollapse);

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

      app.canvas.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button === 0 || e.button === 1) {
          isDragging = true;
          dragStart = { x: e.clientX, y: e.clientY };
          stageStart = { x: app.stage.x, y: app.stage.y };
        }
      });

      app.canvas.addEventListener('pointermove', (e: PointerEvent) => {
        if (isDragging) {
          const dx = e.clientX - dragStart.x;
          const dy = e.clientY - dragStart.y;
          app.stage.x = stageStart.x + dx;
          app.stage.y = stageStart.y + dy;
        }
      });

      app.canvas.addEventListener('pointerup', () => {
        isDragging = false;
      });

      app.canvas.addEventListener('pointerleave', () => {
        isDragging = false;
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
      } else {
        // Escape: Save and exit editing mode
        updateNodeText(editing.nodeId, editing.text);
        setEditing(null);
      }
    }
  }, [editing, nodes, updateNodeText, createSiblingNode, createChildNode, startEditingNode]);

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
    }
  }, [editing, updateNodeText]);

  // Track the nodeId being edited to detect when we start editing a NEW node
  const editingNodeIdRef = useRef<string | null>(null);

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

      const isSelected = nodeId === selectedNodeId;
      const container = new Container();
      container.x = layout.x;
      container.y = layout.y;
      container.eventMode = 'static';
      container.cursor = 'pointer';

      // Node background
      const bg = new Graphics();
      bg.roundRect(0, 0, layout.width, layout.height, NODE_RADIUS);
      bg.fill(isSelected ? COLORS.nodeSelected : COLORS.node);
      bg.stroke({
        width: 2,
        color: isSelected ? COLORS.nodeSelectedBorder : COLORS.nodeBorder,
      });
      container.addChild(bg);

      // Node text
      const text = node.content.type === 'text' ? node.content.text : '[image]';
      const textStyle = new TextStyle({
        fontSize: 14,
        fill: COLORS.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      });
      const textObj = new Text({ text: text || '(empty)', style: textStyle });
      textObj.x = NODE_PADDING_X;
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
          e.stopPropagation();
          toggleCollapse(nodeId);
        });

        container.addChild(indicatorContainer);
      }

      // Click handler with double-click detection
      container.on('pointerdown', (e) => {
        e.stopPropagation();
        const now = Date.now();
        const lastClickTime = clickTimesRef.current.get(nodeId) || 0;
        const timeDiff = now - lastClickTime;

        if (timeDiff < 300 && timeDiff > 0) {
          // Double-click: start in-place editing
          startEditingNode(nodeId);
          clickTimesRef.current.set(nodeId, 0); // Reset to prevent triple-click
        } else {
          // Single click: select node
          selectNode(nodeId);
          clickTimesRef.current.set(nodeId, now);
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
  }, [nodes, rootId, selectedNodeId, selectNode, startEditingNode, toggleCollapse]);

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
    }
  }, [editing, selectedNodeId, nodes, createChildNode, createSiblingNode, startEditingNode]);

  // Focus the wrapper when canvas is clicked (to receive keyboard events)
  const handleWrapperClick = useCallback(() => {
    if (!editing) {
      wrapperRef.current?.focus();
    }
  }, [editing]);

  // Focus wrapper when PixiJS is ready to ensure keyboard events work
  useEffect(() => {
    if (isReady && wrapperRef.current && !editing) {
      wrapperRef.current.focus();
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
        className="w-full h-full"
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
