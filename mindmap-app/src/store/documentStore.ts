// Document state management with Zustand

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Node, NodeMap, ViewMode, Viewport } from '../types';

// History state for undo/redo
interface HistoryEntry {
  nodes: NodeMap;
  rootId: string;
}

const MAX_HISTORY_SIZE = 50;

// Generate unique ID
const generateId = (): string => {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Create initial root node
const createRootNode = (): Node => ({
  id: 'root',
  parentId: null,
  childIds: [],
  content: { type: 'text', text: '中心トピック' },
  position: { x: 0, y: 0, source: 'auto' },
  isCollapsed: false,
});

// Create sample document with some nodes for testing
const createInitialNodes = (): NodeMap => {
  const root = createRootNode();
  const child1: Node = {
    id: 'child-1',
    parentId: 'root',
    childIds: ['grandchild-1'],
    content: { type: 'text', text: 'アイデア 1' },
    position: { x: 0, y: 0, source: 'auto' },
    isCollapsed: false,
  };
  const child2: Node = {
    id: 'child-2',
    parentId: 'root',
    childIds: [],
    content: { type: 'text', text: 'アイデア 2' },
    position: { x: 0, y: 0, source: 'auto' },
    isCollapsed: false,
  };
  const grandchild1: Node = {
    id: 'grandchild-1',
    parentId: 'child-1',
    childIds: [],
    content: { type: 'text', text: 'サブアイデア 1-1' },
    position: { x: 0, y: 0, source: 'auto' },
    isCollapsed: false,
  };

  root.childIds = ['child-1', 'child-2'];

  return {
    root,
    'child-1': child1,
    'child-2': child2,
    'grandchild-1': grandchild1,
  };
};

interface DocumentState {
  // Document data
  nodes: NodeMap;
  rootId: string;

  // File state
  currentFilePath: string | null;
  isDirty: boolean;

  // UI state
  selectedNodeId: string | null;
  editingNodeId: string | null;
  viewMode: ViewMode;
  viewport: Viewport;

  // History state for undo/redo
  history: HistoryEntry[];
  historyIndex: number;

  // Actions
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  stopEditing: () => void;
  updateNodeText: (nodeId: string, text: string) => void;
  createChildNode: (parentId: string) => void;
  createSiblingNode: (siblingId: string) => void;
  deleteNode: (nodeId: string) => void;
  toggleCollapse: (nodeId: string) => void;

  // File actions
  setFilePath: (path: string | null) => void;
  markClean: () => void;
  loadDocument: (nodes: NodeMap, rootId: string, filePath: string | null) => void;
  newDocument: () => void;

  // View actions
  setViewMode: (mode: ViewMode) => void;

  // History actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// Helper to deep clone nodes for history
const cloneNodes = (nodes: NodeMap): NodeMap => {
  return JSON.parse(JSON.stringify(nodes));
};

// Helper to save current state to history
const saveToHistory = (state: DocumentState) => {
  // Remove any future history if we're not at the end
  const newHistory = state.history.slice(0, state.historyIndex + 1);

  // Add current state to history
  newHistory.push({
    nodes: cloneNodes(state.nodes),
    rootId: state.rootId,
  });

  // Limit history size
  if (newHistory.length > MAX_HISTORY_SIZE) {
    newHistory.shift();
  } else {
    state.historyIndex = newHistory.length - 1;
  }

  state.history = newHistory;
};

export const useDocumentStore = create<DocumentState>()(
  immer((set, get) => ({
    // Initial state
    nodes: createInitialNodes(),
    rootId: 'root',
    currentFilePath: null,
    isDirty: false,
    selectedNodeId: 'root',
    editingNodeId: null,
    viewMode: 'outline',
    viewport: { x: 0, y: 0, zoom: 1 },

    // History state
    history: [{ nodes: createInitialNodes(), rootId: 'root' }],
    historyIndex: 0,

    // Actions
    selectNode: (nodeId) =>
      set((state) => {
        state.selectedNodeId = nodeId;
      }),

    startEditing: (nodeId) =>
      set((state) => {
        state.editingNodeId = nodeId;
        state.selectedNodeId = nodeId;
        // Note: MindMap mode now has its own in-place editing, so we don't switch modes
      }),

    stopEditing: () =>
      set((state) => {
        state.editingNodeId = null;
      }),

    updateNodeText: (nodeId, text) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (node && node.content.type === 'text') {
          // Save to history before making changes
          saveToHistory(state);
          node.content.text = text;
          state.isDirty = true;
        }
      }),

    createChildNode: (parentId) =>
      set((state) => {
        const parent = state.nodes[parentId];
        if (!parent) return;

        // Save to history before making changes
        saveToHistory(state);

        // Create new node
        const newId = generateId();
        const newNode: Node = {
          id: newId,
          parentId: parentId,
          childIds: [],
          content: { type: 'text', text: '' },
          position: { x: 0, y: 0, source: 'auto' },
          isCollapsed: false,
        };

        // Add to nodes
        state.nodes[newId] = newNode;

        // Add to parent's children
        parent.childIds.push(newId);

        // Expand parent if collapsed
        parent.isCollapsed = false;

        // Select and start editing the new node
        state.selectedNodeId = newId;
        state.editingNodeId = newId;
        state.isDirty = true;
      }),

    createSiblingNode: (siblingId) =>
      set((state) => {
        const sibling = state.nodes[siblingId];
        if (!sibling) return;

        // Can't create sibling for root node
        if (!sibling.parentId) return;

        const parent = state.nodes[sibling.parentId];
        if (!parent) return;

        // Save to history before making changes
        saveToHistory(state);

        // Create new node
        const newId = generateId();
        const newNode: Node = {
          id: newId,
          parentId: sibling.parentId,
          childIds: [],
          content: { type: 'text', text: '' },
          position: { x: 0, y: 0, source: 'auto' },
          isCollapsed: false,
        };

        // Add to nodes
        state.nodes[newId] = newNode;

        // Insert after the sibling in parent's children
        const siblingIndex = parent.childIds.indexOf(siblingId);
        parent.childIds.splice(siblingIndex + 1, 0, newId);

        // Select and start editing the new node
        state.selectedNodeId = newId;
        state.editingNodeId = newId;
        state.isDirty = true;
      }),

    deleteNode: (nodeId) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        // Can't delete root node
        if (!node.parentId) return;

        const parent = state.nodes[node.parentId];
        if (!parent) return;

        // Save to history before making changes
        saveToHistory(state);

        // Helper function to recursively delete a node and its descendants
        const deleteNodeAndDescendants = (id: string) => {
          const n = state.nodes[id];
          if (!n) return;

          // Delete all children first
          for (const childId of n.childIds) {
            deleteNodeAndDescendants(childId);
          }

          // Delete this node
          delete state.nodes[id];
        };

        // Remove from parent's childIds
        const nodeIndex = parent.childIds.indexOf(nodeId);
        parent.childIds.splice(nodeIndex, 1);

        // Delete the node and all its descendants
        deleteNodeAndDescendants(nodeId);

        // Select the parent node
        state.selectedNodeId = node.parentId;
        state.editingNodeId = null;
        state.isDirty = true;
      }),

    toggleCollapse: (nodeId) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        // Only toggle if node has children
        if (node.childIds.length > 0) {
          node.isCollapsed = !node.isCollapsed;
        }
      }),

    // File actions
    setFilePath: (path) =>
      set((state) => {
        state.currentFilePath = path;
      }),

    markClean: () =>
      set((state) => {
        state.isDirty = false;
      }),

    loadDocument: (nodes, rootId, filePath) =>
      set((state) => {
        state.nodes = nodes;
        state.rootId = rootId;
        state.currentFilePath = filePath;
        state.isDirty = false;
        state.selectedNodeId = rootId;
        state.editingNodeId = null;
        // Reset history with loaded document
        state.history = [{ nodes: cloneNodes(nodes), rootId }];
        state.historyIndex = 0;
      }),

    newDocument: () =>
      set((state) => {
        const root = createRootNode();
        state.nodes = { root };
        state.rootId = 'root';
        state.currentFilePath = null;
        state.isDirty = false;
        state.selectedNodeId = 'root';
        state.editingNodeId = null;
        // Reset history with new document
        state.history = [{ nodes: cloneNodes({ root }), rootId: 'root' }];
        state.historyIndex = 0;
      }),

    // View actions
    setViewMode: (mode) =>
      set((state) => {
        state.viewMode = mode;
        // Stop editing when switching modes
        state.editingNodeId = null;
      }),

    // History actions
    undo: () =>
      set((state) => {
        if (state.historyIndex > 0) {
          state.historyIndex -= 1;
          const entry = state.history[state.historyIndex];
          state.nodes = cloneNodes(entry.nodes);
          state.rootId = entry.rootId;
          state.isDirty = true;
          state.editingNodeId = null;
          // Keep selection if node still exists, otherwise select root
          if (!state.nodes[state.selectedNodeId || '']) {
            state.selectedNodeId = state.rootId;
          }
        }
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex += 1;
          const entry = state.history[state.historyIndex];
          state.nodes = cloneNodes(entry.nodes);
          state.rootId = entry.rootId;
          state.isDirty = true;
          state.editingNodeId = null;
          // Keep selection if node still exists, otherwise select root
          if (!state.nodes[state.selectedNodeId || '']) {
            state.selectedNodeId = state.rootId;
          }
        }
      }),

    canUndo: () => {
      const state = get();
      return state.historyIndex > 0;
    },

    canRedo: () => {
      const state = get();
      return state.historyIndex < state.history.length - 1;
    },
  }))
);
