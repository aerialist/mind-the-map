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

// Clipboard data for copy/cut/paste
interface ClipboardData {
  nodes: NodeMap;
  rootIds: string[]; // Root nodes of the copied subtrees
  mode: 'copy' | 'cut';
  sourceNodeIds: string[]; // Original node IDs (for cut operation)
}

// Collapse all state for three-way cycling
// 'collapsed' -> 'expanded-except-completed' -> 'expanded' -> 'collapsed' ...
type CollapseAllState = 'collapsed' | 'expanded-except-completed' | 'expanded';

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
  content: { type: 'text', text: 'My Big Idea 💡' },
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
    content: { type: 'text', text: 'What if we...' },
    position: { x: 0, y: 0, source: 'auto' },
    isCollapsed: false,
  };
  const child2: Node = {
    id: 'child-2',
    parentId: 'root',
    childIds: [],
    content: { type: 'text', text: 'Mind = Blown 🤯' },
    position: { x: 0, y: 0, source: 'auto' },
    isCollapsed: false,
  };
  const grandchild1: Node = {
    id: 'grandchild-1',
    parentId: 'child-1',
    childIds: [],
    content: { type: 'text', text: 'This could be huge!' },
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

// Icon filter for search - stores type and value to uniquely identify an icon
interface IconFilter {
  type: string;
  value: string | number;
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

  // Filter state (applies directly to document view)
  activeIconFilters: IconFilter[]; // Currently active icon filters
  hiddenIconFilters: IconFilter[]; // Currently hidden icon filters
  availableIcons: IconFilter[]; // Icons that exist in the document

  // Help dialog state
  isHelpOpen: boolean;

  // About dialog state
  isAboutOpen: boolean;

  // Icon picker state
  isIconPickerOpen: boolean;

  // Link dialog state
  isLinkDialogOpen: boolean;

  // Collapse all state for cycling
  collapseAllState: CollapseAllState;

  // Clipboard state
  clipboard: ClipboardData | null;

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
  createSiblingNodeAbove: (siblingId: string) => void;
  deleteNode: (nodeId: string) => void;
  toggleCollapse: (nodeId: string) => void;
  toggleCollapseAll: (nodeId: string) => void;
  expandAllChildren: (nodeId: string) => void;
  collapseAllChildren: (nodeId: string) => void;
  moveNode: (nodeId: string, newParentId: string, insertIndex: number) => void;
  indentNode: (nodeId: string) => void;
  outdentNode: (nodeId: string) => void;

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
  toggleSearch: () => void;
  setSearchQuery: (query: string) => void;
  selectSearchResult: (index: number) => void;
  navigateToSearchResult: () => void;
  selectNodeFromSearch: (index: number) => void;

  // Filter actions (applies to document view)
  toggleActiveIconFilter: (filter: IconFilter) => void;
  clearActiveIconFilters: () => void;
  toggleHiddenIconFilter: (filter: IconFilter) => void;
  clearHiddenIconFilters: () => void;
  refreshAvailableIcons: () => void;

  // Help actions
  openHelp: () => void;
  closeHelp: () => void;
  toggleHelp: () => void;

  // About actions
  openAbout: () => void;
  closeAbout: () => void;
  toggleAbout: () => void;

  // Icon actions
  openIconPicker: () => void;
  closeIconPicker: () => void;
  addIcon: (nodeId: string, icon: NodeIcon) => void;
  removeIcon: (nodeId: string, iconIndex: number) => void;
  cycleIcon: (nodeId: string, iconIndex: number) => void;
  clearIcons: (nodeId: string) => void;

  // Link actions
  openLinkDialog: () => void;
  closeLinkDialog: () => void;
  toggleLinkPanel: () => void;
  setNodeLink: (nodeId: string, link: string | undefined) => void;

  // Clipboard actions
  copyNodes: (nodeIds: string[]) => void;
  cutNodes: (nodeIds: string[]) => void;
  pasteNodes: (targetParentId: string) => void;
  pasteNodesFromText: (targetParentId: string, text: string) => void;
  pasteNodesFromExternal: (
    targetParentId: string,
    nodes: NodeMap,
    rootIds: string[]
  ) => void;

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

// Helper to update search results based on query (text only, no icon filters)
const updateSearchResults = (state: DocumentState) => {
  const query = state.searchQuery;

  // If no query, show no results
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
};

// Helper to collect all unique icons from all nodes
const collectAllIcons = (state: DocumentState): IconFilter[] => {
  const iconSet = new Map<string, IconFilter>();
  const collectIcons = (nodeId: string) => {
    const node = state.nodes[nodeId];
    if (!node) return;
    if (node.icons) {
      for (const icon of node.icons) {
        const key = `${icon.type}:${icon.value}`;
        if (!iconSet.has(key)) {
          iconSet.set(key, { type: icon.type, value: icon.value });
        }
      }
    }
    for (const childId of node.childIds) {
      collectIcons(childId);
    }
  };
  collectIcons(state.rootId);
  return Array.from(iconSet.values());
};

// Helper to compute visible node IDs based on active icon filters
// A node is visible if it matches any filter OR if any descendant matches
// When no filters are active, all nodes are visible
export const computeVisibleNodeIds = (
  nodes: NodeMap,
  rootId: string,
  activeIconFilters: IconFilter[],
  hiddenIconFilters: IconFilter[] = []
): Set<string> => {
  // If no filters active, collect all nodes first
  const allNodes = new Set<string>();
  const collectAll = (nodeId: string) => {
    allNodes.add(nodeId);
    const node = nodes[nodeId];
    if (node) {
      for (const childId of node.childIds) {
        collectAll(childId);
      }
    }
  };
  collectAll(rootId);

  // If hidden filters are active, remove matching nodes
  if (hiddenIconFilters.length > 0) {
    const nodeMatchesHiddenFilter = (nodeId: string): boolean => {
      const node = nodes[nodeId];
      if (!node || !node.icons) return false;
      return node.icons.some((icon) =>
        hiddenIconFilters.some(
          (filter) => filter.type === icon.type && filter.value === icon.value
        )
      );
    };

    // Remove nodes that match hidden filters
    for (const nodeId of allNodes) {
      if (nodeMatchesHiddenFilter(nodeId)) {
        allNodes.delete(nodeId);
      }
    }

    // If only hidden filters are active, return the filtered set
    if (activeIconFilters.length === 0) {
      return allNodes;
    }
  }

  // If no active filters, return all (potentially filtered by hidden)
  if (activeIconFilters.length === 0) {
    return allNodes;
  }

  // Apply active filters (show only matching)
  const visibleNodes = new Set<string>();

  // Check if a node matches any active filter
  const nodeMatchesFilter = (nodeId: string): boolean => {
    const node = nodes[nodeId];
    if (!node || !node.icons) return false;
    return node.icons.some((icon) =>
      activeIconFilters.some(
        (filter) => filter.type === icon.type && filter.value === icon.value
      )
    );
  };

  // Recursively check if a node or any descendant matches
  // Returns true if this subtree contains any matching nodes
  const checkSubtree = (nodeId: string): boolean => {
    const node = nodes[nodeId];
    if (!node) return false;

    // Skip if node was hidden
    if (!allNodes.has(nodeId)) return false;

    // Check children first
    let hasMatchingDescendant = false;
    for (const childId of node.childIds) {
      if (checkSubtree(childId)) {
        hasMatchingDescendant = true;
      }
    }

    // Node is visible if it matches or has matching descendants
    const matches = nodeMatchesFilter(nodeId);
    if (matches || hasMatchingDescendant) {
      visibleNodes.add(nodeId);
      return true;
    }

    return false;
  };

  // Always include root so tree structure is maintained
  visibleNodes.add(rootId);
  checkSubtree(rootId);

  return visibleNodes;
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
    selectedNodeIds: ['root'],
    editingNodeId: null,
    viewMode: 'outline',
    viewport: { x: 0, y: 0, zoom: 1 },

    // Search state
    isSearchOpen: false,
    searchQuery: '',
    searchResults: [],
    searchSelectedIndex: 0,

    // Filter state
    activeIconFilters: [],
    hiddenIconFilters: [],
    availableIcons: [],

    // Help dialog state
    isHelpOpen: false,

    // About dialog state
    isAboutOpen: false,

    // Icon picker state
    isIconPickerOpen: false,

    // Link dialog state
    isLinkDialogOpen: false,

    // Collapse all state for cycling
    collapseAllState: 'expanded' as CollapseAllState,

    // Clipboard state
    clipboard: null,

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

    createSiblingNodeAbove: (siblingId) =>
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

        // Insert before the sibling in parent's children
        const siblingIndex = parent.childIds.indexOf(siblingId);
        parent.childIds.splice(siblingIndex, 0, newId);

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

    toggleCollapseAll: (nodeId) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        // Only toggle if node has children
        if (node.childIds.length === 0) return;

        // Helper to check if a node has a complete (done) status icon
        const hasCompleteIcon = (n: Node): boolean => {
          return n.icons?.some(icon => icon.type === 'status' && icon.value === 'done') ?? false;
        };

        // Cycle through three states: collapsed -> expanded-except-completed -> expanded -> collapsed
        const currentState = state.collapseAllState;
        let nextState: CollapseAllState;

        if (currentState === 'collapsed') {
          nextState = 'expanded-except-completed';
        } else if (currentState === 'expanded-except-completed') {
          nextState = 'expanded';
        } else {
          nextState = 'collapsed';
        }

        state.collapseAllState = nextState;

        // Helper to recursively set collapse state for a node and all its descendants
        const setCollapseRecursive = (currentNodeId: string) => {
          const currentNode = state.nodes[currentNodeId];
          if (!currentNode) return;

          // Only set collapse state if node has children
          if (currentNode.childIds.length > 0) {
            if (nextState === 'collapsed') {
              // Collapse all nodes
              currentNode.isCollapsed = true;
            } else if (nextState === 'expanded-except-completed') {
              // Expand all except nodes with complete icon
              currentNode.isCollapsed = hasCompleteIcon(currentNode);
            } else {
              // Expand all nodes
              currentNode.isCollapsed = false;
            }
          }

          // Process all children recursively
          for (const childId of currentNode.childIds) {
            setCollapseRecursive(childId);
          }
        };

        // Apply to the selected node and all its descendants
        setCollapseRecursive(nodeId);
      }),

    expandAllChildren: (nodeId) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        // Only expand if node has children
        if (node.childIds.length === 0) return;

        const setCollapseRecursive = (currentNodeId: string) => {
          const currentNode = state.nodes[currentNodeId];
          if (!currentNode) return;

          if (currentNode.childIds.length > 0) {
            currentNode.isCollapsed = false;
          }

          for (const childId of currentNode.childIds) {
            setCollapseRecursive(childId);
          }
        };

        state.collapseAllState = 'expanded';
        setCollapseRecursive(nodeId);
      }),

    collapseAllChildren: (nodeId) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        // Only collapse if node has children
        if (node.childIds.length === 0) return;

        const setCollapseRecursive = (currentNodeId: string) => {
          const currentNode = state.nodes[currentNodeId];
          if (!currentNode) return;

          if (currentNode.childIds.length > 0) {
            currentNode.isCollapsed = true;
          }

          for (const childId of currentNode.childIds) {
            setCollapseRecursive(childId);
          }
        };

        state.collapseAllState = 'collapsed';
        setCollapseRecursive(nodeId);
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

    indentNode: (nodeId) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        // Can't indent root node
        if (!node.parentId) return;

        const parent = state.nodes[node.parentId];
        if (!parent) return;

        // Find this node's index in parent's children
        const nodeIndex = parent.childIds.indexOf(nodeId);
        if (nodeIndex <= 0) return; // Can't indent if first child (no sibling above)

        // Get the sibling node above
        const newParentId = parent.childIds[nodeIndex - 1];
        const newParent = state.nodes[newParentId];
        if (!newParent) return;

        // Save to history before making changes
        saveToHistory(state);

        // Remove from current parent
        parent.childIds.splice(nodeIndex, 1);

        // Add as last child of the sibling above
        newParent.childIds.push(nodeId);

        // Update node's parent reference
        node.parentId = newParentId;

        // Expand new parent if collapsed
        newParent.isCollapsed = false;

        state.isDirty = true;
      }),

    outdentNode: (nodeId) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        // Can't outdent root node
        if (!node.parentId) return;

        const parent = state.nodes[node.parentId];
        if (!parent) return;

        // Can't outdent if parent is root (would make it a sibling of root)
        if (!parent.parentId) return;

        const grandparent = state.nodes[parent.parentId];
        if (!grandparent) return;

        // Save to history before making changes
        saveToHistory(state);

        // Remove from current parent
        const nodeIndex = parent.childIds.indexOf(nodeId);
        if (nodeIndex !== -1) {
          parent.childIds.splice(nodeIndex, 1);
        }

        // Find parent's position in grandparent's children
        const parentIndex = grandparent.childIds.indexOf(parent.id);

        // Insert as sibling right after the parent
        grandparent.childIds.splice(parentIndex + 1, 0, nodeId);

        // Update node's parent reference
        node.parentId = parent.parentId;

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
        // Refresh available icons when opening
        state.availableIcons = collectAllIcons(state);
      }),

    closeSearch: () =>
      set((state) => {
        state.isSearchOpen = false;
        state.searchQuery = '';
        state.searchResults = [];
        state.searchSelectedIndex = 0;
      }),

    toggleSearch: () =>
      set((state) => {
        if (state.isSearchOpen) {
          // Close
          state.isSearchOpen = false;
          state.searchQuery = '';
          state.searchResults = [];
          state.searchSelectedIndex = 0;
        } else {
          // Open
          state.isSearchOpen = true;
          state.searchQuery = '';
          state.searchResults = [];
          state.searchSelectedIndex = 0;
          state.editingNodeId = null;
          // Refresh available icons when opening
          state.availableIcons = collectAllIcons(state);
        }
      }),

    // Help actions
    openHelp: () =>
      set((state) => {
        state.isHelpOpen = true;
        state.editingNodeId = null;
      }),

    closeHelp: () =>
      set((state) => {
        state.isHelpOpen = false;
      }),

    toggleHelp: () =>
      set((state) => {
        state.isHelpOpen = !state.isHelpOpen;
        if (state.isHelpOpen) {
          state.editingNodeId = null;
        }
      }),

    openAbout: () =>
      set((state) => {
        state.isAboutOpen = true;
        state.editingNodeId = null;
      }),

    closeAbout: () =>
      set((state) => {
        state.isAboutOpen = false;
      }),

    toggleAbout: () =>
      set((state) => {
        state.isAboutOpen = !state.isAboutOpen;
        if (state.isAboutOpen) {
          state.editingNodeId = null;
        }
      }),

    setSearchQuery: (query) =>
      set((state) => {
        state.searchQuery = query;
        state.searchSelectedIndex = 0;
        updateSearchResults(state);
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

    selectNodeFromSearch: (index) =>
      set((state) => {
        const result = state.searchResults[index];
        if (!result) return;

        // Update selected index
        state.searchSelectedIndex = index;

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

        // Select the node but keep search panel open
        state.selectedNodeId = result.nodeId;
        state.selectedNodeIds = [result.nodeId];
      }),

    // Filter actions (applies to document view)
    toggleActiveIconFilter: (filter: IconFilter) =>
      set((state) => {
        const existingIndex = state.activeIconFilters.findIndex(
          (f: IconFilter) => f.type === filter.type && f.value === filter.value
        );
        if (existingIndex >= 0) {
          state.activeIconFilters.splice(existingIndex, 1);
        } else {
          state.activeIconFilters.push(filter);
        }
      }),

    clearActiveIconFilters: () =>
      set((state) => {
        state.activeIconFilters = [];
      }),

    toggleHiddenIconFilter: (filter: IconFilter) =>
      set((state) => {
        const existingIndex = state.hiddenIconFilters.findIndex(
          (f: IconFilter) => f.type === filter.type && f.value === filter.value
        );
        if (existingIndex >= 0) {
          state.hiddenIconFilters.splice(existingIndex, 1);
        } else {
          state.hiddenIconFilters.push(filter);
        }
      }),

    clearHiddenIconFilters: () =>
      set((state) => {
        state.hiddenIconFilters = [];
      }),

    refreshAvailableIcons: () =>
      set((state) => {
        state.availableIcons = collectAllIcons(state);
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

    // Link actions
    openLinkDialog: () =>
      set((state) => {
        state.isLinkDialogOpen = true;
        state.editingNodeId = null;
      }),

    closeLinkDialog: () =>
      set((state) => {
        state.isLinkDialogOpen = false;
      }),

    toggleLinkPanel: () =>
      set((state) => {
        state.isLinkDialogOpen = !state.isLinkDialogOpen;
        if (state.isLinkDialogOpen) {
          state.editingNodeId = null;
        }
      }),

    setNodeLink: (nodeId, link) =>
      set((state) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        // Save to history before making changes
        saveToHistory(state);

        if (link && link.trim()) {
          node.link = link.trim();
        } else {
          delete node.link;
        }

        state.isDirty = true;
      }),

    // Clipboard actions
    copyNodes: (nodeIds) =>
      set((state) => {
        if (nodeIds.length === 0) return;

        // Filter out nodes that don't exist
        const validNodeIds = nodeIds.filter((id) => state.nodes[id]);
        if (validNodeIds.length === 0) return;

        // Helper to collect a node and all its descendants
        const collectNodeTree = (nodeId: string): NodeMap => {
          const result: NodeMap = {};
          const node = state.nodes[nodeId];
          if (!node) return result;

          // Clone the node
          result[nodeId] = JSON.parse(JSON.stringify(node));

          // Recursively collect children
          for (const childId of node.childIds) {
            const childNodes = collectNodeTree(childId);
            Object.assign(result, childNodes);
          }

          return result;
        };

        // Collect all nodes from all selected subtrees
        const clipboardNodes: NodeMap = {};
        for (const nodeId of validNodeIds) {
          const subtree = collectNodeTree(nodeId);
          Object.assign(clipboardNodes, subtree);
        }

        // Set parent to null for root nodes of the clipboard (they will be re-parented on paste)
        for (const nodeId of validNodeIds) {
          if (clipboardNodes[nodeId]) {
            clipboardNodes[nodeId].parentId = null;
          }
        }

        state.clipboard = {
          nodes: clipboardNodes,
          rootIds: validNodeIds,
          mode: 'copy',
          sourceNodeIds: validNodeIds,
        };
      }),

    cutNodes: (nodeIds) =>
      set((state) => {
        if (nodeIds.length === 0) return;

        // Filter out nodes that don't exist and root node (can't cut root)
        const validNodeIds = nodeIds.filter(
          (id) => state.nodes[id] && state.nodes[id].parentId !== null
        );
        if (validNodeIds.length === 0) return;

        // Save to history before making changes
        saveToHistory(state);

        // Helper to collect a node and all its descendants
        const collectNodeTree = (nodeId: string): NodeMap => {
          const result: NodeMap = {};
          const node = state.nodes[nodeId];
          if (!node) return result;

          // Clone the node
          result[nodeId] = JSON.parse(JSON.stringify(node));

          // Recursively collect children
          for (const childId of node.childIds) {
            const childNodes = collectNodeTree(childId);
            Object.assign(result, childNodes);
          }

          return result;
        };

        // Collect all nodes from all selected subtrees
        const clipboardNodes: NodeMap = {};
        for (const nodeId of validNodeIds) {
          const subtree = collectNodeTree(nodeId);
          Object.assign(clipboardNodes, subtree);
        }

        // Set parent to null for root nodes of the clipboard
        for (const nodeId of validNodeIds) {
          if (clipboardNodes[nodeId]) {
            clipboardNodes[nodeId].parentId = null;
          }
        }

        // Helper to delete node and descendants
        const deleteNodeAndDescendants = (id: string) => {
          const n = state.nodes[id];
          if (!n) return;

          for (const childId of n.childIds) {
            deleteNodeAndDescendants(childId);
          }
          delete state.nodes[id];
        };

        // Immediately remove the cut nodes from the tree
        let newSelectedNodeId: string | null = null;
        for (const nodeId of validNodeIds) {
          const node = state.nodes[nodeId];
          if (node && node.parentId) {
            const parent = state.nodes[node.parentId];
            if (parent) {
              // Remember parent for selection after cut
              if (!newSelectedNodeId) {
                newSelectedNodeId = node.parentId;
              }
              // Remove from parent's childIds
              const index = parent.childIds.indexOf(nodeId);
              if (index !== -1) {
                parent.childIds.splice(index, 1);
              }
            }
          }
          deleteNodeAndDescendants(nodeId);
        }

        state.clipboard = {
          nodes: clipboardNodes,
          rootIds: validNodeIds.map((id) => id), // Keep original IDs for reference
          mode: 'cut',
          sourceNodeIds: validNodeIds,
        };

        // Select the parent of the first cut node
        state.selectedNodeId = newSelectedNodeId || state.rootId;
        state.selectedNodeIds = [state.selectedNodeId];
        state.isDirty = true;
      }),

    pasteNodes: (targetParentId) =>
      set((state) => {
        if (!state.clipboard || state.clipboard.rootIds.length === 0) return;

        const targetParent = state.nodes[targetParentId];
        if (!targetParent) return;

        // Save to history before making changes
        saveToHistory(state);

        // Deep clone clipboard data to avoid mutation issues with Immer
        const clipboardNodes: NodeMap = JSON.parse(JSON.stringify(state.clipboard.nodes));
        const clipboardRootIds: string[] = [...state.clipboard.rootIds];

        // Generate new IDs for all nodes to avoid conflicts
        const idMapping: Record<string, string> = {};
        for (const oldId of Object.keys(clipboardNodes)) {
          idMapping[oldId] = generateId();
        }

        // Create new nodes with updated IDs and references
        const newRootIds: string[] = [];
        for (const oldRootId of clipboardRootIds) {
          const newRootId = idMapping[oldRootId];
          newRootIds.push(newRootId);
        }

        // Add all nodes with new IDs
        for (const [oldId, oldNode] of Object.entries(clipboardNodes)) {
          const newId = idMapping[oldId];
          const newNode: Node = {
            ...oldNode,
            id: newId,
            parentId: oldNode.parentId ? idMapping[oldNode.parentId] : null,
            // Map childIds, filtering out any that aren't in the clipboard
            childIds: oldNode.childIds
              .map((childId) => idMapping[childId])
              .filter((id): id is string => id !== undefined),
            position: { x: 0, y: 0, source: 'auto' as const }, // Reset position
          };

          // Set parent for root nodes of pasted subtrees
          if (clipboardRootIds.includes(oldId)) {
            newNode.parentId = targetParentId;
          }

          state.nodes[newId] = newNode;
        }

        // Add new root nodes to target parent's children
        targetParent.childIds.push(...newRootIds);

        // Expand target parent if collapsed
        targetParent.isCollapsed = false;

        // After cut-paste, convert to copy mode so subsequent pastes work
        // (the original nodes were already removed during cut)
        if (state.clipboard.mode === 'cut') {
          state.clipboard = {
            ...state.clipboard,
            mode: 'copy',
          };
        }

        // Select the first pasted node
        if (newRootIds.length > 0) {
          state.selectedNodeId = newRootIds[0];
          state.selectedNodeIds = newRootIds;
        }

        state.isDirty = true;
      }),

    pasteNodesFromText: (targetParentId, text) =>
      set((state) => {
        const targetParent = state.nodes[targetParentId];
        if (!targetParent) return;

        // Save to history before making changes
        saveToHistory(state);

        // Create new node with the text content
        const newId = generateId();
        const newNode: Node = {
          id: newId,
          parentId: targetParentId,
          childIds: [],
          content: { type: 'text', text: text.trim() },
          position: { x: 0, y: 0, source: 'auto' },
          isCollapsed: false,
        };

        state.nodes[newId] = newNode;
        targetParent.childIds.push(newId);

        // Expand parent if collapsed
        targetParent.isCollapsed = false;

        // Select the new node
        state.selectedNodeId = newId;
        state.selectedNodeIds = [newId];
        state.isDirty = true;
      }),

    pasteNodesFromExternal: (targetParentId, externalNodes, rootIds) =>
      set((state) => {
        const targetParent = state.nodes[targetParentId];
        if (!targetParent || rootIds.length === 0) return;

        // Save to history before making changes
        saveToHistory(state);

        // Add all nodes to state
        for (const [nodeId, node] of Object.entries(externalNodes)) {
          state.nodes[nodeId] = node;
        }

        // Update root nodes to have target parent
        for (const rootId of rootIds) {
          if (state.nodes[rootId]) {
            state.nodes[rootId].parentId = targetParentId;
          }
        }

        // Add root nodes to target parent's children
        targetParent.childIds.push(...rootIds);

        // Expand parent if collapsed
        targetParent.isCollapsed = false;

        // Select the first pasted node
        if (rootIds.length > 0) {
          state.selectedNodeId = rootIds[0];
          state.selectedNodeIds = [...rootIds];
        }

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
