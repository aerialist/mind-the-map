import { useEffect, useRef, useCallback, useState } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useDocumentStore } from '../../store';
import type { Node, NodeMap } from '../../types';

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
};

interface NodeLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Calculate tree layout
const calculateLayout = (
  nodes: NodeMap,
  rootId: string
): Map<string, NodeLayout> => {
  const layouts = new Map<string, NodeLayout>();

  // First pass: calculate node sizes
  const getNodeWidth = (node: Node): number => {
    const text = node.content.type === 'text' ? node.content.text : '[image]';
    const estimatedWidth = text.length * 8 + NODE_PADDING_X * 2;
    return Math.max(estimatedWidth, NODE_MIN_WIDTH);
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
  const appRef = useRef<Application | null>(null);
  const nodesContainerRef = useRef<Container | null>(null);
  const edgesContainerRef = useRef<Container | null>(null);
  const [isReady, setIsReady] = useState(false);

  const nodes = useDocumentStore((state) => state.nodes);
  const rootId = useDocumentStore((state) => state.rootId);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const selectNode = useDocumentStore((state) => state.selectNode);
  const startEditing = useDocumentStore((state) => state.startEditing);

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

  // Render nodes and edges
  const render = useCallback(() => {
    const nodesContainer = nodesContainerRef.current;
    const edgesContainer = edgesContainerRef.current;
    if (!nodesContainer || !edgesContainer) return;

    // Clear previous render
    nodesContainer.removeChildren();
    edgesContainer.removeChildren();

    // Calculate layout
    const layouts = calculateLayout(nodes, rootId);

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

      // Click handler with double-click detection
      let lastClickTime = 0;
      container.on('pointerdown', (e) => {
        e.stopPropagation();
        const now = Date.now();
        const timeDiff = now - lastClickTime;

        if (timeDiff < 300) {
          // Double-click: switch to outline mode and start editing
          startEditing(nodeId);
        } else {
          // Single click: select node
          selectNode(nodeId);
        }

        lastClickTime = now;
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
  }, [nodes, rootId, selectedNodeId, selectNode, startEditing]);

  // Re-render when data changes or app becomes ready
  useEffect(() => {
    if (isReady) {
      render();
    }
  }, [isReady, render]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ touchAction: 'none' }}
    />
  );
}

export default MindMapCanvas;
