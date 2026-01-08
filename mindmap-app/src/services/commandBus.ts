import { useDocumentStore, computeVisibleNodeIds } from '../store';
import { saveDocument, saveDocumentAs, openDocument } from './tauri/fileSystem';
import { exportToPDF } from './pdfExport';

export type CommandPayload = {
  id: string;
  args?: unknown;
};

type CommandHandler = (args?: unknown) => void | Promise<void>;

const handlers = new Map<string, Set<CommandHandler>>();

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

  registerCommandHandler('view.find', () => {
    useDocumentStore.getState().toggleSearch();
  });

  registerCommandHandler('app.help.toggle', () => {
    useDocumentStore.getState().toggleHelp();
  });

  registerCommandHandler('app.about.toggle', () => {
    useDocumentStore.getState().toggleAbout();
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
};

registerDefaults();
