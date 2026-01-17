import { ask } from '@tauri-apps/plugin-dialog';
import { useDocumentStore, computeVisibleNodeIds } from '../store';
import { useSettingsStore } from '../store/settingsStore';
import {
  getDownNodeId,
  getFirstChildNodeId,
  getFirstSiblingNodeId,
  getLastChildNodeId,
  getLastSiblingNodeId,
  getParentNodeId,
  getUpNodeId,
} from '../core/navigation';
import {
  saveDocument,
  saveDocumentAs,
  openDocument,
  openFolder,
  readDirectoryTree,
} from './tauri/fileSystem';
import { exportToPDF } from './pdfExport';
import { buildNodesFromFolderTree } from '../core/folderMap';
import { isTauriAvailable } from './tauri/safeTauri';
import { importFromWorkflowy, pushToWorkflowy, pullFromWorkflowy, WorkflowyError } from './workflowy';

export type CommandPayload = {
  id: string;
  args?: unknown;
};

type CommandHandler = (args?: unknown) => void | Promise<void>;

const handlers = new Map<string, Set<CommandHandler>>();

const confirmDiscardChanges = async (actionLabel: string): Promise<boolean> => {
  const message = `You have unsaved changes. ${actionLabel} will replace the current document. Continue?`;

  if (isTauriAvailable()) {
    try {
      const confirmed = await ask(message, {
        title: 'Unsaved Changes',
        kind: 'warning',
      });
      return Boolean(confirmed);
    } catch {
      // Fall back to browser confirm
    }
  }

  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }

  return false;
};

const confirmIncludeHidden = async (): Promise<boolean> => {
  const message = 'Include hidden files and folders (starting with a dot)?';

  if (isTauriAvailable()) {
    try {
      const confirmed = await ask(message, {
        title: 'Map Folder',
        kind: 'info',
      });
      return Boolean(confirmed);
    } catch {
      // Fall back to browser confirm
    }
  }

  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }

  return false;
};

const getNodeIdArg = (args: unknown): string | null => {
  if (!args || typeof args !== 'object') return null;
  const nodeId = (args as { nodeId?: unknown }).nodeId;
  return typeof nodeId === 'string' ? nodeId : null;
};

const runHandler = (handler: CommandHandler, args?: unknown) => {
  try {
    const result = handler(args);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => {});
    }
  } catch {}
};

export const registerCommandHandler = (id: string, handler: CommandHandler) => {
  let set = handlers.get(id);
  if (!set) {
    set = new Set();
    handlers.set(id, set);
  }
  set.add(handler);

  return () => {
    set?.delete(handler);
    if (set && set.size === 0) {
      handlers.delete(id);
    }
  };
};

export const dispatch = (id: string, args?: unknown) => {
  const set = handlers.get(id);
  if (!set || set.size === 0) return;
  for (const handler of Array.from(set)) {
    runHandler(handler, args);
  }
};

let defaultsRegistered = false;

const registerDefaults = () => {
  if (defaultsRegistered) return;
  defaultsRegistered = true;

  const getNavigableState = () => {
    const state = useDocumentStore.getState();
    if (!state.selectedNodeId || state.editingNodeId) return null;
    return { ...state, selectedNodeId: state.selectedNodeId };
  };

  const selectNodeIfAvailable = (nodeId: string | null) => {
    if (!nodeId) return;
    useDocumentStore.getState().selectNode(nodeId);
  };

  registerCommandHandler('file.new', () => {
    useDocumentStore.getState().newDocument();
  });

  registerCommandHandler('file.open', async () => {
    const result = await openDocument();
    if (result.success && result.nodes && result.rootId) {
      useDocumentStore.getState().loadDocument(
        result.nodes,
        result.rootId,
        result.path || null
      );
    } else if (result.error !== 'Open cancelled') {
      console.error('Open failed:', result.error);
    }
  });

  registerCommandHandler('file.mapFolder', async () => {
    const state = useDocumentStore.getState();
    if (state.isDirty) {
      const confirmed = await confirmDiscardChanges('Mapping a folder');
      if (!confirmed) return;
    }

    const folderResult = await openFolder();
    if (!folderResult.success || !folderResult.path) {
      if (folderResult.error && folderResult.error !== 'Open cancelled') {
        console.error('Map folder failed:', folderResult.error);
      }
      return;
    }

    const includeHidden = await confirmIncludeHidden();
    const treeResult = await readDirectoryTree(folderResult.path, includeHidden);
    if (!treeResult.success || !treeResult.tree) {
      if (treeResult.error) {
        console.error('Map folder failed:', treeResult.error);
      }
      return;
    }

    const { nodes, rootId } = buildNodesFromFolderTree(treeResult.tree);
    useDocumentStore.getState().loadDocument(nodes, rootId, null);
  });

  registerCommandHandler('file.mapWorkflowy', async () => {
    const state = useDocumentStore.getState();
    if (state.isDirty) {
      const confirmed = await confirmDiscardChanges('Importing from Workflowy');
      if (!confirmed) return;
    }

    const settings = useSettingsStore.getState().settings;
    const bulletId = settings.workflowy.targetBulletId.trim();

    if (!bulletId) {
      console.error('Map Workflowy failed: No target bullet ID configured');
      return;
    }

    try {
      const result = await importFromWorkflowy(bulletId);
      useDocumentStore.getState().loadDocument(result.nodes, result.rootId, null);
    } catch (error) {
      if (error instanceof WorkflowyError) {
        console.error('Map Workflowy failed:', error.message);
      } else {
        console.error('Map Workflowy failed:', error);
      }
    }
  });

  registerCommandHandler('file.save', async () => {
    const state = useDocumentStore.getState();
    if (state.currentFilePath) {
      const result = await saveDocument(
        state.nodes,
        state.rootId,
        state.currentFilePath
      );
      if (result.success) {
        state.markClean();
      } else {
        console.error('Save failed:', result.error);
      }
    } else {
      const result = await saveDocumentAs(state.nodes, state.rootId);
      if (result.success && result.path) {
        state.setFilePath(result.path);
        state.markClean();
      } else if (result.error !== 'Save cancelled') {
        console.error('Save failed:', result.error);
      }
    }
  });

  registerCommandHandler('file.saveAs', async () => {
    const state = useDocumentStore.getState();
    const result = await saveDocumentAs(state.nodes, state.rootId);
    if (result.success && result.path) {
      state.setFilePath(result.path);
      state.markClean();
    } else if (result.error !== 'Save cancelled') {
      console.error('Save failed:', result.error);
    }
  });

  registerCommandHandler('file.print', async () => {
    const state = useDocumentStore.getState();
    const visibleNodeIds = computeVisibleNodeIds(
      state.nodes,
      state.rootId,
      state.activeIconFilters,
      state.hiddenIconFilters
    );
    const result = await exportToPDF(
      state.viewMode,
      state.nodes,
      state.rootId,
      visibleNodeIds,
      state.currentFilePath
    );
    if (!result.success && result.error !== 'Save cancelled') {
      console.error('PDF export failed:', result.error);
    }
  });

  registerCommandHandler('view.mindmap', () => {
    useDocumentStore.getState().setViewMode('mindmap');
  });

  registerCommandHandler('view.outline', () => {
    useDocumentStore.getState().setViewMode('outline');
  });

  registerCommandHandler('view.toggle', () => {
    const state = useDocumentStore.getState();
    const nextMode = state.viewMode === 'mindmap' ? 'outline' : 'mindmap';
    state.setViewMode(nextMode);
  });

  registerCommandHandler('view.find', () => {
    useDocumentStore.getState().toggleSearch();
  });

  registerCommandHandler('app.help.toggle', () => {
    useDocumentStore.getState().toggleHelp();
  });

  registerCommandHandler('app.about.toggle', () => {
    useDocumentStore.getState().toggleAbout();
  });

  registerCommandHandler('app.settings.toggle', () => {
    useSettingsStore.getState().toggleSettings();
  });

  registerCommandHandler('edit.undo', () => {
    useDocumentStore.getState().undo();
  });

  registerCommandHandler('edit.redo', () => {
    useDocumentStore.getState().redo();
  });

  registerCommandHandler('node.select', (args) => {
    const targetId = getNodeIdArg(args);
    if (!targetId) return;
    useDocumentStore.getState().selectNode(targetId);
  });

  registerCommandHandler('node.edit', (args) => {
    const state = useDocumentStore.getState();
    const targetId = getNodeIdArg(args) ?? state.selectedNodeId;
    if (!targetId || state.editingNodeId) return;
    state.startEditing(targetId);
  });

  registerCommandHandler('node.createChild', (args) => {
    const state = useDocumentStore.getState();
    const explicitId = getNodeIdArg(args);
    const targetId = explicitId ?? state.selectedNodeId;
    if (!targetId) return;
    if (state.editingNodeId && !explicitId) return;
    state.createChildNode(targetId);
  });

  registerCommandHandler('node.createSibling', (args) => {
    const state = useDocumentStore.getState();
    const explicitId = getNodeIdArg(args);
    const targetId = explicitId ?? state.selectedNodeId;
    if (!targetId) return;
    if (state.editingNodeId && !explicitId) return;
    state.createSiblingNode(targetId);
  });

  registerCommandHandler('node.createSiblingAbove', (args) => {
    const state = useDocumentStore.getState();
    const explicitId = getNodeIdArg(args);
    const targetId = explicitId ?? state.selectedNodeId;
    if (!targetId) return;
    if (state.editingNodeId && !explicitId) return;
    state.createSiblingNodeAbove(targetId);
  });

  registerCommandHandler('node.duplicate', (args) => {
    const state = useDocumentStore.getState();
    const explicitId = getNodeIdArg(args);
    const targetId = explicitId ?? state.selectedNodeId;
    if (!targetId) return;
    if (state.editingNodeId && !explicitId) return;
    state.duplicateNode(targetId);
  });

  registerCommandHandler('node.focusParent', (args) => {
    const state = useDocumentStore.getState();
    const targetId = getNodeIdArg(args) ?? state.selectedNodeId;
    if (!targetId) return;
    const parentId = state.nodes[targetId]?.parentId ?? null;
    if (!parentId) return;
    state.startEditing(parentId);
  });

  registerCommandHandler('node.delete', (args) => {
    const state = useDocumentStore.getState();
    const explicitId = getNodeIdArg(args);
    const targetId = explicitId ?? state.selectedNodeId;
    if (!targetId) return;
    if (state.editingNodeId && !explicitId) return;
    state.deleteNode(targetId);
  });

  registerCommandHandler('node.toggleCollapse', (args) => {
    const state = useDocumentStore.getState();
    const explicitId = getNodeIdArg(args);
    const targetId = explicitId ?? state.selectedNodeId;
    if (!targetId) return;
    if (state.editingNodeId && !explicitId) return;
    state.toggleCollapse(targetId);
  });

  registerCommandHandler('node.toggleCollapseAll', (args) => {
    const state = useDocumentStore.getState();
    const explicitId = getNodeIdArg(args);
    const targetId = explicitId ?? state.selectedNodeId;
    if (!targetId) return;
    if (state.editingNodeId && !explicitId) return;
    state.toggleCollapseAll(targetId);
  });

  registerCommandHandler('node.expandAllChildren', (args) => {
    const state = useDocumentStore.getState();
    const explicitId = getNodeIdArg(args);
    const targetId = explicitId ?? state.selectedNodeId;
    if (!targetId) return;
    if (state.editingNodeId && !explicitId) return;
    state.expandAllChildren(targetId);
  });

  registerCommandHandler('node.collapseAllChildren', (args) => {
    const state = useDocumentStore.getState();
    const explicitId = getNodeIdArg(args);
    const targetId = explicitId ?? state.selectedNodeId;
    if (!targetId) return;
    if (state.editingNodeId && !explicitId) return;
    state.collapseAllChildren(targetId);
  });

  registerCommandHandler('node.indent', (args) => {
    const state = useDocumentStore.getState();
    const targetId = getNodeIdArg(args) ?? state.selectedNodeId;
    if (!targetId) return;
    state.indentNode(targetId);
  });

  registerCommandHandler('node.outdent', (args) => {
    const state = useDocumentStore.getState();
    const targetId = getNodeIdArg(args) ?? state.selectedNodeId;
    if (!targetId) return;
    state.outdentNode(targetId);
  });

  registerCommandHandler('node.moveUp', (args) => {
    const state = useDocumentStore.getState();
    const targetId = getNodeIdArg(args) ?? state.selectedNodeId;
    if (!targetId) return;
    const node = state.nodes[targetId];
    if (!node || !node.parentId) return;
    const parent = state.nodes[node.parentId];
    if (!parent) return;
    const nodeIndex = parent.childIds.indexOf(targetId);
    if (nodeIndex <= 0) return;
    state.moveNode(targetId, node.parentId, nodeIndex - 1);
  });

  registerCommandHandler('node.moveDown', (args) => {
    const state = useDocumentStore.getState();
    const targetId = getNodeIdArg(args) ?? state.selectedNodeId;
    if (!targetId) return;
    const node = state.nodes[targetId];
    if (!node || !node.parentId) return;
    const parent = state.nodes[node.parentId];
    if (!parent) return;
    const nodeIndex = parent.childIds.indexOf(targetId);
    if (nodeIndex === -1 || nodeIndex >= parent.childIds.length - 1) return;
    state.moveNode(targetId, node.parentId, nodeIndex + 2);
  });

  registerCommandHandler('node.openIconPicker', (args) => {
    const state = useDocumentStore.getState();
    if (state.editingNodeId && !getNodeIdArg(args)) return;
    state.openIconPicker();
  });

  registerCommandHandler('node.addLink', (args) => {
    const state = useDocumentStore.getState();
    if (state.editingNodeId && !getNodeIdArg(args)) return;
    state.toggleLinkPanel();
  });

  registerCommandHandler('node.addNote', (args) => {
    const state = useDocumentStore.getState();
    if (state.editingNodeId && !getNodeIdArg(args)) return;
    state.toggleNotePanel();
  });

  registerCommandHandler('navigate.siblingUp', () => {
    const state = getNavigableState();
    if (!state) return;
    const nextId = getUpNodeId(state.nodes, state.selectedNodeId);
    selectNodeIfAvailable(nextId);
  });

  registerCommandHandler('navigate.siblingDown', () => {
    const state = getNavigableState();
    if (!state) return;
    const nextId = getDownNodeId(state.nodes, state.selectedNodeId);
    selectNodeIfAvailable(nextId);
  });

  registerCommandHandler('navigate.parent', () => {
    const state = getNavigableState();
    if (!state) return;
    const nextId = getParentNodeId(state.nodes, state.selectedNodeId);
    selectNodeIfAvailable(nextId);
  });

  registerCommandHandler('navigate.firstChild', () => {
    const state = getNavigableState();
    if (!state) return;
    const current = state.nodes[state.selectedNodeId];
    if (!current) return;
    if (current.childIds.length > 0 && current.isCollapsed) {
      state.toggleCollapse(current.id);
      selectNodeIfAvailable(current.childIds[0]);
      return;
    }
    const nextId = getFirstChildNodeId(state.nodes, state.selectedNodeId);
    selectNodeIfAvailable(nextId);
  });

  registerCommandHandler('navigate.firstSibling', () => {
    const state = getNavigableState();
    if (!state) return;
    const nextId = getFirstSiblingNodeId(state.nodes, state.selectedNodeId);
    selectNodeIfAvailable(nextId);
  });

  registerCommandHandler('navigate.lastSibling', () => {
    const state = getNavigableState();
    if (!state) return;
    const nextId = getLastSiblingNodeId(state.nodes, state.selectedNodeId);
    selectNodeIfAvailable(nextId);
  });

  registerCommandHandler('navigate.lastChild', () => {
    const state = getNavigableState();
    if (!state) return;
    const current = state.nodes[state.selectedNodeId];
    if (!current) return;
    if (current.childIds.length > 0 && current.isCollapsed) {
      state.toggleCollapse(current.id);
      selectNodeIfAvailable(current.childIds[current.childIds.length - 1]);
      return;
    }
    const nextId = getLastChildNodeId(state.nodes, state.selectedNodeId);
    selectNodeIfAvailable(nextId);
  });

  registerCommandHandler('workflowy.push', async () => {
    const state = useDocumentStore.getState();
    const { nodes, rootId } = state;

    if (!rootId) {
      state.showToast('Push failed: No document', 'error');
      return;
    }

    const rootNode = nodes[rootId];
    if (!rootNode?.workflowySync) {
      state.showToast('Push failed: Document not synced with Workflowy', 'error');
      return;
    }

    try {
      // Set syncing state
      state.setSyncStatus(true, 'push');

      const result = await pushToWorkflowy(nodes, rootId);

      // Update the document with modified nodes (sync metadata updated)
      state.loadDocument(result.updatedNodes, rootId, state.currentFilePath);

      // Build success message
      const stats = [];
      if (result.created > 0) stats.push(`${result.created} created`);
      if (result.updated > 0) stats.push(`${result.updated} updated`);
      if (result.deleted > 0) stats.push(`${result.deleted} deleted`);
      if (result.moved > 0) stats.push(`${result.moved} moved`);

      const summary = stats.length > 0 ? stats.join(', ') : 'No changes';

      // Log warnings and errors
      if (result.warnings.length > 0) {
        console.warn('Push warnings:', result.warnings);
      }

      if (result.errors.length > 0) {
        console.error('Push errors:', result.errors);
      }

      // Show appropriate toast based on result
      if (result.errors.length > 0) {
        // If there are errors, show error toast
        const errorMsg = `Push completed with errors: ${summary}\n${result.errors.length} errors occurred (check console)`;
        state.showToast(errorMsg, 'error');
      } else if (result.warnings.length > 0) {
        // If there are warnings but no errors, show info toast
        const warningMsg = `Push completed with warnings: ${summary}\n${result.warnings.length} conflicts detected`;
        state.showToast(warningMsg, 'info');
      } else {
        // No issues, show success toast
        state.showToast(`Push completed: ${summary}`, 'success');
      }
    } catch (error) {
      if (error instanceof WorkflowyError) {
        state.showToast(`Push failed: ${error.message}`, 'error');
      } else {
        state.showToast('Push failed: Unknown error', 'error');
        console.error('Push to Workflowy failed:', error);
      }
    } finally {
      // Clear syncing state
      state.setSyncStatus(false, null);
    }
  });

  registerCommandHandler('workflowy.pull', async () => {
    const state = useDocumentStore.getState();
    const { nodes, rootId } = state;

    if (!rootId) {
      state.showToast('Pull failed: No document', 'error');
      return;
    }

    const rootNode = nodes[rootId];
    if (!rootNode?.workflowySync) {
      state.showToast('Pull failed: Document not synced with Workflowy', 'error');
      return;
    }

    const bulletId = rootNode.workflowySync.workflowyId;

    try {
      // Set syncing state
      state.setSyncStatus(true, 'pull');

      const result = await pullFromWorkflowy(bulletId, nodes);

      // Update the document with merged nodes
      state.loadDocument(result.nodes, rootId, state.currentFilePath);

      // Build success message
      let message = 'Pull completed';
      if (result.conflicts.length > 0) {
        message += `\n${result.conflicts.length} conflicts detected (remote version accepted)`;
        console.warn('Pull conflicts:', result.conflicts);
      }

      state.showToast(message, result.conflicts.length > 0 ? 'info' : 'success');
    } catch (error) {
      if (error instanceof WorkflowyError) {
        state.showToast(`Pull failed: ${error.message}`, 'error');
      } else {
        state.showToast('Pull failed: Unknown error', 'error');
        console.error('Pull from Workflowy failed:', error);
      }
    } finally {
      // Clear syncing state
      state.setSyncStatus(false, null);
    }
  });
};

registerDefaults();
