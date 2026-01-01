// Document state management with Zustand

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Node, NodeMap, ViewMode, Viewport, NodeIcon } from '../types';
import { getNextIconInCategory } from '../types';

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

// Search result type
interface SearchResult {
  nodeId: string;
  text: string;
  path: string[]; // Breadcrumb path from root to this node
}

interface DocumentState {
  // Document data
  nodes: NodeMap;
  rootId: string;

  // File state
  currentFilePath: string | null;
  isDirty: boolean;

  // UI state
  selectedNodeId: string | null;
  selectedNodeIds: string[]; // For multi-selection (Ctrl+click, Shift+click)
  editingNodeId: string | null;
  viewMode: ViewMode;
  viewport: Viewport;

  // Search state
  isSearchOpen: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  searchSelectedIndex: number;

  // Icon picker state
  isIconPickerOpen: boolean;

  // History state for undo/redo
  history: HistoryEntry[];
  historyIndex: number;

  // Actions
  selectNode: (nodeId: string | null) => void;
  toggleNodeSelection: (nodeId: string) => void; // Ctrl+click
  selectNodeRange: (nodeId: string) => void; // Shift+click
  clearMultiSelection: () => void;
  startEditing: (nodeId: string) => void;
  stopEditing: () => void;
  updateNodeText: (nodeId: string, text: string) => void;
  createChildNode: (parentId: string) => void;
  createSiblingNode: (siblingId: string) => void;
  deleteNode: (nodeId: string) => void;
  toggleCollapse: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string, insertIndex: number) => void;

  // File actions
  setFilePath: (path: string | null) => void;
  markClean: () => void;
  loadDocument: (nodes: NodeMap, rootId: string, filePath: string | null) => void;
  newDocument: () => void;

  // View actions
  setViewMode: (mode: ViewMode) => void;

  // Search actions
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  selectSearchResult: (index: number) => void;
  navigateToSearchResult: () => void;

  // Icon actions
  openIconPicker: () => void;
  closeIconPicker: () => void;
  addIcon: (nodeId: string, icon: NodeIcon) => void;
  removeIcon: (nodeId: string, iconIndex: number) => void;
  cycleIcon: (nodeId: string, iconIndex: number) => void;
  clearIcons: (nodeId: string) => void;

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
    selectedNodeIds: [],
    editingNodeId: null,
    viewMode: 'outline',
    viewport: { x: 0, y: 0, zoom: 1 },

    // Search state
    isSearchOpen: false,
    searchQuery: '',
    searchResults: [],
    searchSelectedIndex: 0,

    // Icon picker state
    isIconPickerOpen: false,

    // History state
    history: [{ nodes: createInitialNodes(), rootId: 'root' }],
    historyIndex: 0,

    // Actions
    selectNode: (nodeId) =>
      set((state) => {
        state.selectedNodeId = nodeId;
        state.selectedNodeIds = nodeId ? [nodeId] : [];
      }),

    toggleNodeSelection: (nodeId) =>
      set((state) => {
        if (state.selectedNodeIds.includes(nodeId)) {
          // Remove from selection
          state.selectedNodeIds = state.selectedNodeIds.filter((id) => id !== nodeId);
          // Update primary selection
          if (state.selectedNodeId === nodeId) {
            state.selectedNodeId = state.selectedNodeIds[0] || null;
          }
        } else {
          // Add to selection
          state.selectedNodeIds.push(nodeId);
          state.selectedNodeId = nodeId;
        }
      }),

    selectNodeRange: (nodeId) =>
      set((state) => {
        if (!state.selectedNodeId) {
          // No current selection, just select this node
          state.selectedNodeId = nodeId;
          state.selectedNodeIds = [nodeId];
          return;
        }

        // Get all visible nodes in order (DFS traversal)
        const getVisibleNodes = (currentNodeId: string): string[] => {
          const node = state.nodes[currentNodeId];
          if (!node) return [];
          const result: string[] = [currentNodeId];
          if (!node.isCollapsed) {
            for (const childId of node.childIds) {
              result.push(...getVisibleNodes(childId));
            }
          }
          return result;
        };

        const visibleNodes = getVisibleNodes(state.rootId);
        const startIndex = visibleNodes.indexOf(state.selectedNodeId);
        const endIndex = visibleNodes.indexOf(nodeId);

        if (startIndex === -1 || endIndex === -1) {
          // One of the nodes not visible, just select the new node
          state.selectedNodeId = nodeId;
          state.selectedNodeIds = [nodeId];
          return;
        }

        // Select all nodes in range
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        state.selectedNodeIds = visibleNodes.slice(minIndex, maxIndex + 1);
        // Keep the original selectedNodeId as the anchor
      }),

    clearMultiSelection: () =>
      set((state) => {
        if (state.selectedNodeId) {
          state.selectedNodeIds = [state.selectedNodeId];
        } else {
          state.selectedNodeIds = [];
        }
      }),

    startEditing: (nodeId) =>
      set((state) => {
        state.editingNodeId = nodeId;
        state.selectedNodeId = nodeId;
        state.selectedNodeIds = [nodeId]; // Clear multi-selection when editing
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
        state.selectedNodeIds = [newId];
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
        state.selectedNodeIds = [newId];
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
        state.selectedNodeIds = node.parentId ? [node.parentId] : [];
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

    moveNode: (nodeId, newParentId, insertIndex) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        // Can't move root node
        if (!node.parentId) return;

        // Can't move a node to itself or its descendants
        const isDescendant = (ancestorId: string, descendantId: string): boolean => {
          let currentId: string | null = descendantId;
          while (currentId) {
            if (currentId === ancestorId) return true;
            const currentNode: Node | undefined = state.nodes[currentId];
            currentId = currentNode?.parentId ?? null;
          }
          return false;
        };

        if (nodeId === newParentId || isDescendant(nodeId, newParentId)) return;

        const oldParent = state.nodes[node.parentId];
        const newParent = state.nodes[newParentId];
        if (!oldParent || !newParent) return;

        // Save to history before making changes
        saveToHistory(state);

        // Remove from old parent
        const oldIndex = oldParent.childIds.indexOf(nodeId);
        if (oldIndex !== -1) {
          oldParent.childIds.splice(oldIndex, 1);
        }

        // Adjust insert index if moving within the same parent
        let adjustedIndex = insertIndex;
        if (node.parentId === newParentId && oldIndex < insertIndex) {
          adjustedIndex = insertIndex - 1;
        }

        // Add to new parent at the specified index
        newParent.childIds.splice(adjustedIndex, 0, nodeId);

        // Update node's parent reference
        node.parentId = newParentId;

        // Expand new parent if collapsed
        newParent.isCollapsed = false;

        state.isDirty = true;
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
        state.selectedNodeIds = [rootId];
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
        state.selectedNodeIds = ['root'];
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

    // Search actions
    openSearch: () =>
      set((state) => {
        state.isSearchOpen = true;
        state.searchQuery = '';
        state.searchResults = [];
        state.searchSelectedIndex = 0;
        state.editingNodeId = null;
      }),

    closeSearch: () =>
      set((state) => {
        state.isSearchOpen = false;
        state.searchQuery = '';
        state.searchResults = [];
        state.searchSelectedIndex = 0;
      }),

    setSearchQuery: (query) =>
      set((state) => {
        state.searchQuery = query;
        state.searchSelectedIndex = 0;

        if (!query.trim()) {
          state.searchResults = [];
          return;
        }

        const lowerQuery = query.toLowerCase();
        const results: SearchResult[] = [];

        // Helper to get breadcrumb path for a node
        const getPath = (nodeId: string): string[] => {
          const path: string[] = [];
          let currentId: string | null = nodeId;
          while (currentId) {
            const currentNode: Node | undefined = state.nodes[currentId];
            if (!currentNode) break;
            if (currentNode.content.type === 'text') {
              path.unshift(currentNode.content.text);
            }
            currentId = currentNode.parentId;
          }
          return path;
        };

        // Traverse all nodes to find matches
        const traverse = (nodeId: string): void => {
          const traverseNode: Node | undefined = state.nodes[nodeId];
          if (!traverseNode) return;

          if (traverseNode.content.type === 'text') {
            const text = traverseNode.content.text;
            if (text.toLowerCase().includes(lowerQuery)) {
              results.push({
                nodeId,
                text,
                path: getPath(nodeId),
              });
            }
          }

          // Search all children regardless of collapse state
          for (const childId of traverseNode.childIds) {
            traverse(childId);
          }
        };

        traverse(state.rootId);
        state.searchResults = results;
      }),

    selectSearchResult: (index) =>
      set((state) => {
        if (index >= 0 && index < state.searchResults.length) {
          state.searchSelectedIndex = index;
        }
      }),

    navigateToSearchResult: () =>
      set((state) => {
        const result = state.searchResults[state.searchSelectedIndex];
        if (!result) return;

        // Expand all ancestors to make the node visible
        let currentId: string | null = result.nodeId;
        while (currentId) {
          const currentNode: Node | undefined = state.nodes[currentId];
          if (!currentNode) break;
          if (currentNode.parentId) {
            const parent: Node | undefined = state.nodes[currentNode.parentId];
            if (parent && parent.isCollapsed) {
              parent.isCollapsed = false;
            }
          }
          currentId = currentNode.parentId;
        }

        // Select the node and close search
        state.selectedNodeId = result.nodeId;
        state.selectedNodeIds = [result.nodeId];
        state.isSearchOpen = false;
        state.searchQuery = '';
        state.searchResults = [];
        state.searchSelectedIndex = 0;
      }),

    // Icon actions
    openIconPicker: () =>
      set((state) => {
        state.isIconPickerOpen = true;
        state.editingNodeId = null;
      }),

    closeIconPicker: () =>
      set((state) => {
        state.isIconPickerOpen = false;
      }),

    addIcon: (nodeId, icon) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        // Save to history before making changes
        saveToHistory(state);

        // Initialize icons array if needed
        if (!node.icons) {
          node.icons = [];
        }

        // Check if icon of same type already exists
        const existingIndex = node.icons.findIndex((i) => i.type === icon.type);
        if (existingIndex >= 0) {
          // Replace existing icon of same type
          node.icons[existingIndex] = icon;
        } else {
          // Add new icon
          node.icons.push(icon);
        }

        state.isDirty = true;
      }),

    removeIcon: (nodeId, iconIndex) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node || !node.icons) return;

        // Save to history before making changes
        saveToHistory(state);

        node.icons.splice(iconIndex, 1);

        // Clean up empty array
        if (node.icons.length === 0) {
          delete node.icons;
        }

        state.isDirty = true;
      }),

    cycleIcon: (nodeId, iconIndex) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node || !node.icons || iconIndex >= node.icons.length) return;

        // Save to history before making changes
        saveToHistory(state);

        // Get the next icon in the same category
        const currentIcon = node.icons[iconIndex];
        const nextIcon = getNextIconInCategory(currentIcon);
        node.icons[iconIndex] = nextIcon;

        state.isDirty = true;
      }),

    clearIcons: (nodeId) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node || !node.icons) return;

        // Save to history before making changes
        saveToHistory(state);

        delete node.icons;
        state.isDirty = true;
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
            state.selectedNodeIds = [state.rootId];
          } else {
            // Filter out any selected nodes that no longer exist
            state.selectedNodeIds = state.selectedNodeIds.filter((id) => state.nodes[id]);
            if (state.selectedNodeIds.length === 0 && state.selectedNodeId) {
              state.selectedNodeIds = [state.selectedNodeId];
            }
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
            state.selectedNodeIds = [state.rootId];
          } else {
            // Filter out any selected nodes that no longer exist
            state.selectedNodeIds = state.selectedNodeIds.filter((id) => state.nodes[id]);
            if (state.selectedNodeIds.length === 0 && state.selectedNodeId) {
              state.selectedNodeIds = [state.selectedNodeId];
            }
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
