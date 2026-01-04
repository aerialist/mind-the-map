import { useEffect, useRef, useCallback } from 'react';
import { useDocumentStore } from '../store';
import {
  getUpNodeId,
  getDownNodeId,
  getParentNodeId,
  getFirstChildNodeId,
} from '../core/navigation';
import {
  parseHtmlToNodes,
  parsedNodesToNodeMap,
  parseIndentedTextToNodes,
  nodesToHtml,
  nodesToPlainText,
  nodesToMiroFormat,
} from '../core/clipboard';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

export const useKeyboardNavigation = () => {
  const nodes = useDocumentStore((state) => state.nodes);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const selectedNodeIds = useDocumentStore((state) => state.selectedNodeIds);
  const editingNodeId = useDocumentStore((state) => state.editingNodeId);
  const selectNode = useDocumentStore((state) => state.selectNode);

  // Track the last text we wrote to system clipboard
  // Used to detect if user copied something externally
  const lastWrittenClipboardTextRef = useRef<string | null>(null);
  const startEditing = useDocumentStore((state) => state.startEditing);
  const createChildNode = useDocumentStore((state) => state.createChildNode);
  const createSiblingNode = useDocumentStore((state) => state.createSiblingNode);
  const createSiblingNodeAbove = useDocumentStore((state) => state.createSiblingNodeAbove);
  const deleteNode = useDocumentStore((state) => state.deleteNode);
  const toggleCollapse = useDocumentStore((state) => state.toggleCollapse);
  const toggleCollapseAll = useDocumentStore((state) => state.toggleCollapseAll);
  const openIconPicker = useDocumentStore((state) => state.openIconPicker);
  const copyNodes = useDocumentStore((state) => state.copyNodes);
  const cutNodes = useDocumentStore((state) => state.cutNodes);
  const pasteNodes = useDocumentStore((state) => state.pasteNodes);
  const pasteNodesFromText = useDocumentStore((state) => state.pasteNodesFromText);
  const pasteNodesFromExternal = useDocumentStore(
    (state) => state.pasteNodesFromExternal
  );
  const undo = useDocumentStore((state) => state.undo);
  const redo = useDocumentStore((state) => state.redo);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle undo/redo globally (even during editing)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // Alternative redo shortcut: Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }

      // Note: Copy/Cut/Paste (Cmd+C/X/V) are handled via native menu events (menu-copy, menu-cut, menu-paste)
      // The native menu items trigger events that call performCopy/performCut/performPaste

      // Copy for Miro (Ctrl+Shift+M) - exports as table format for Miro's paste dialog
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        if (!editingNodeId && selectedNodeIds.length > 0) {
          e.preventDefault();

          // Collect nodes for the selected subtrees
          const collectSubtree = (nodeId: string): Record<string, typeof nodes[string]> => {
            const result: Record<string, typeof nodes[string]> = {};
            const node = nodes[nodeId];
            if (!node) return result;
            result[nodeId] = node;
            for (const childId of node.childIds) {
              Object.assign(result, collectSubtree(childId));
            }
            return result;
          };

          const subtreeNodes: Record<string, typeof nodes[string]> = {};
          for (const nodeId of selectedNodeIds) {
            Object.assign(subtreeNodes, collectSubtree(nodeId));
          }

          // Generate Miro-compatible format (table/TSV)
          const { html: htmlContent, text: textContent } = nodesToMiroFormat(
            subtreeNodes,
            selectedNodeIds
          );

          // Store the text for later comparison
          lastWrittenClipboardTextRef.current = textContent;

          // Write to system clipboard with both formats
          try {
            const clipboardItems = [
              new ClipboardItem({
                'text/plain': new Blob([textContent], { type: 'text/plain' }),
                'text/html': new Blob([htmlContent], { type: 'text/html' }),
              }),
            ];
            navigator.clipboard.write(clipboardItems).catch(() => {
              navigator.clipboard.writeText(textContent).catch(() => {});
            });
          } catch {
            navigator.clipboard.writeText(textContent).catch(() => {});
          }

          // Don't update internal clipboard - this is for external paste only
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        // Cut - only when not editing and has selection (excluding root)
        if (!editingNodeId && selectedNodeIds.length > 0) {
          e.preventDefault();

          // Collect nodes for the selected subtrees (before they're removed)
          const collectSubtree = (nodeId: string): Record<string, typeof nodes[string]> => {
            const result: Record<string, typeof nodes[string]> = {};
            const node = nodes[nodeId];
            if (!node) return result;
            result[nodeId] = node;
            for (const childId of node.childIds) {
              Object.assign(result, collectSubtree(childId));
            }
            return result;
          };

          const subtreeNodes: Record<string, typeof nodes[string]> = {};
          for (const nodeId of selectedNodeIds) {
            Object.assign(subtreeNodes, collectSubtree(nodeId));
          }

          // Generate HTML and plain text for system clipboard
          const htmlContent = nodesToHtml(subtreeNodes, selectedNodeIds);
          const textContent = nodesToPlainText(subtreeNodes, selectedNodeIds);

          // Store the text for later comparison
          lastWrittenClipboardTextRef.current = textContent;

          // Write to system clipboard with both formats
          try {
            const clipboardItems = [
              new ClipboardItem({
                'text/plain': new Blob([textContent], { type: 'text/plain' }),
                'text/html': new Blob([htmlContent], { type: 'text/html' }),
              }),
            ];
            navigator.clipboard.write(clipboardItems).catch(() => {
              // Fallback to text-only
              navigator.clipboard.writeText(textContent).catch(() => {});
            });
          } catch {
            // Fallback for browsers that don't support ClipboardItem
            navigator.clipboard.writeText(textContent).catch(() => {});
          }

          cutNodes(selectedNodeIds);
        }
        return;
      }

      // For Ctrl+V, we don't handle it in keydown - let the native paste event handle it
      // This avoids the permission popup from navigator.clipboard.read()
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        // Only intercept if we're not editing and have a target selected
        // The actual paste handling is done in the 'paste' event listener below
        if (!editingNodeId && selectedNodeId) {
          // Don't prevent default - let the paste event fire
          // The paste event handler will handle the actual paste logic
        }
        return;
      }

      // Skip if no node is selected
      if (!selectedNodeId) return;

      // Skip if currently editing (input handles its own keys)
      if (editingNodeId) return;

      // Skip if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      let nextNodeId: string | null = null;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          nextNodeId = getUpNodeId(nodes, selectedNodeId);
          break;

        case 'ArrowDown':
          e.preventDefault();
          nextNodeId = getDownNodeId(nodes, selectedNodeId);
          break;

        case 'ArrowLeft':
          e.preventDefault();
          // Go to parent
          nextNodeId = getParentNodeId(nodes, selectedNodeId);
          break;

        case 'ArrowRight':
          e.preventDefault();
          {
            // If node has children and is collapsed, expand it first
            const currentNode = nodes[selectedNodeId];
            if (currentNode && currentNode.childIds.length > 0 && currentNode.isCollapsed) {
              toggleCollapse(selectedNodeId);
              // After expanding, navigate to first child
              nextNodeId = currentNode.childIds[0];
            } else {
              // Go to first child (if exists and expanded)
              nextNodeId = getFirstChildNodeId(nodes, selectedNodeId);
            }
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (e.shiftKey) {
            // Create a sibling node above
            createSiblingNodeAbove(selectedNodeId);
          } else {
            // Create a sibling node below
            createSiblingNode(selectedNodeId);
          }
          break;

        case 'Tab':
          e.preventDefault();
          // Create a child node
          createChildNode(selectedNodeId);
          break;

        case 'e':
        case 'E':
        case 'F2':
          e.preventDefault();
          // Start editing the selected node
          startEditing(selectedNodeId);
          break;

        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          // Delete the selected node (won't delete root)
          deleteNode(selectedNodeId);
          break;

        case ' ':
        case '\u00A0': // Non-breaking space (produced by Option+Space on macOS)
          e.preventDefault();
          if (e.shiftKey && e.altKey) {
            // Toggle collapse/expand all children recursively (Shift+Alt+Space)
            toggleCollapseAll(selectedNodeId);
          } else {
            // Toggle collapse/expand for the selected node
            toggleCollapse(selectedNodeId);
          }
          break;

        case 'i':
        case 'I':
          e.preventDefault();
          // Open icon picker (uses currently selected node)
          openIconPicker();
          break;
      }

      if (nextNodeId) {
        selectNode(nextNodeId);
      }
    };

    // Note: Paste is handled via native menu event (menu-paste) which calls performPaste()
    // This avoids duplicate handling and permission issues with clipboard API

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, selectedNodeId, selectedNodeIds, editingNodeId, selectNode, startEditing, createChildNode, createSiblingNode, createSiblingNodeAbove, deleteNode, toggleCollapse, toggleCollapseAll, openIconPicker, undo, redo]);

  // Helper to collect nodes for subtrees
  const collectSubtree = useCallback((nodeId: string): Record<string, typeof nodes[string]> => {
    const result: Record<string, typeof nodes[string]> = {};
    const node = nodes[nodeId];
    if (!node) return result;
    result[nodeId] = node;
    for (const childId of node.childIds) {
      Object.assign(result, collectSubtree(childId));
    }
    return result;
  }, [nodes]);

  // Copy selected nodes to clipboard
  const performCopy = useCallback(() => {
    const currentSelectedNodeIds = useDocumentStore.getState().selectedNodeIds;
    const currentEditingNodeId = useDocumentStore.getState().editingNodeId;
    const currentNodes = useDocumentStore.getState().nodes;

    // Skip if user is focused on an input element (e.g., Link dialog input)
    // Let the browser handle native copy in those cases
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (currentEditingNodeId || currentSelectedNodeIds.length === 0) return;

    const subtreeNodes: Record<string, typeof currentNodes[string]> = {};
    for (const nodeId of currentSelectedNodeIds) {
      const collectNodes = (id: string): void => {
        const node = currentNodes[id];
        if (!node) return;
        subtreeNodes[id] = node;
        for (const childId of node.childIds) {
          collectNodes(childId);
        }
      };
      collectNodes(nodeId);
    }

    // Generate HTML and plain text for system clipboard
    const htmlContent = nodesToHtml(subtreeNodes, currentSelectedNodeIds);
    const textContent = nodesToPlainText(subtreeNodes, currentSelectedNodeIds);

    // Update internal clipboard state synchronously
    copyNodes(currentSelectedNodeIds);

    // Write to system clipboard (async)
    const writeToSystemClipboard = async () => {
      try {
        const clipboardItems = [
          new ClipboardItem({
            'text/plain': new Blob([textContent], { type: 'text/plain' }),
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
          }),
        ];
        await navigator.clipboard.write(clipboardItems);
        lastWrittenClipboardTextRef.current = textContent;
      } catch {
        try {
          await navigator.clipboard.writeText(textContent);
          lastWrittenClipboardTextRef.current = textContent;
        } catch {
          lastWrittenClipboardTextRef.current = null;
        }
      }
    };
    writeToSystemClipboard();
  }, [copyNodes]);

  // Cut selected nodes to clipboard
  const performCut = useCallback(() => {
    const currentSelectedNodeIds = useDocumentStore.getState().selectedNodeIds;
    const currentEditingNodeId = useDocumentStore.getState().editingNodeId;
    const currentNodes = useDocumentStore.getState().nodes;

    // Skip if user is focused on an input element (e.g., Link dialog input)
    // Let the browser handle native cut in those cases
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (currentEditingNodeId || currentSelectedNodeIds.length === 0) return;

    // Filter out root node
    const validNodeIds = currentSelectedNodeIds.filter(
      (id) => currentNodes[id]?.parentId !== null
    );
    if (validNodeIds.length === 0) return;

    const subtreeNodes: Record<string, typeof currentNodes[string]> = {};
    for (const nodeId of validNodeIds) {
      const collectNodes = (id: string): void => {
        const node = currentNodes[id];
        if (!node) return;
        subtreeNodes[id] = node;
        for (const childId of node.childIds) {
          collectNodes(childId);
        }
      };
      collectNodes(nodeId);
    }

    // Generate HTML and plain text for system clipboard
    const htmlContent = nodesToHtml(subtreeNodes, validNodeIds);
    const textContent = nodesToPlainText(subtreeNodes, validNodeIds);

    // Cut nodes (updates internal clipboard and removes from tree)
    cutNodes(validNodeIds);

    // Write to system clipboard (async)
    const writeToSystemClipboard = async () => {
      try {
        const clipboardItems = [
          new ClipboardItem({
            'text/plain': new Blob([textContent], { type: 'text/plain' }),
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
          }),
        ];
        await navigator.clipboard.write(clipboardItems);
        lastWrittenClipboardTextRef.current = textContent;
      } catch {
        try {
          await navigator.clipboard.writeText(textContent);
          lastWrittenClipboardTextRef.current = textContent;
        } catch {
          lastWrittenClipboardTextRef.current = null;
        }
      }
    };
    writeToSystemClipboard();
  }, [cutNodes]);

  // Paste from clipboard (internal or external)
  const performPaste = useCallback(async () => {
    const currentSelectedNodeId = useDocumentStore.getState().selectedNodeId;
    const currentEditingNodeId = useDocumentStore.getState().editingNodeId;
    const currentClipboard = useDocumentStore.getState().clipboard;

    // If user is focused on an input element (e.g., Link dialog input),
    // paste clipboard text into the input since Tauri menu consumed the native event
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const input = activeElement;
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? input.value.length;
          const newValue = input.value.slice(0, start) + text + input.value.slice(end);
          // Trigger React's onChange by using native input setter and dispatching event
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
          )?.set;
          nativeInputValueSetter?.call(input, newValue);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          // Move cursor to end of pasted text
          const newCursorPos = start + text.length;
          input.setSelectionRange(newCursorPos, newCursorPos);
        }
      } catch {
        // Clipboard read failed
      }
      return;
    }
    if (activeElement instanceof HTMLTextAreaElement) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const textarea = activeElement;
          const start = textarea.selectionStart ?? textarea.value.length;
          const end = textarea.selectionEnd ?? textarea.value.length;
          const newValue = textarea.value.slice(0, start) + text + textarea.value.slice(end);
          const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
          )?.set;
          nativeTextAreaValueSetter?.call(textarea, newValue);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          const newCursorPos = start + text.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      } catch {
        // Clipboard read failed
      }
      return;
    }

    if (currentEditingNodeId || !currentSelectedNodeId) return;

    // Read from system clipboard to check for external content
    let textContent = '';
    let htmlContent = '';
    try {
      textContent = await navigator.clipboard.readText();
      // Try to read HTML if available
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          htmlContent = await blob.text();
          break;
        }
      }
    } catch {
      // Clipboard read failed, will use internal clipboard
    }

    // Determine if this is internal or external paste
    const hasInternalClipboard = currentClipboard && currentClipboard.rootIds.length > 0;
    const isInternalPaste = hasInternalClipboard && (
      !textContent ||
      !textContent.trim() ||
      textContent === lastWrittenClipboardTextRef.current
    );

    if (isInternalPaste) {
      // Use internal clipboard
      pasteNodes(currentSelectedNodeId);
    } else if (textContent && textContent.trim()) {
      // External paste - try to parse structured content first

      // Try parsing HTML (ul/li from Workflowy, etc.)
      if (htmlContent) {
        const parsedNodes = parseHtmlToNodes(htmlContent);
        if (parsedNodes.length > 0) {
          const { nodes: newNodes, rootIds } = parsedNodesToNodeMap(
            parsedNodes,
            currentSelectedNodeId
          );
          pasteNodesFromExternal(currentSelectedNodeId, newNodes, rootIds);
          return;
        }
      }

      // Try parsing indented text
      const parsedNodes = parseIndentedTextToNodes(textContent);
      if (parsedNodes.length > 1 || (parsedNodes.length === 1 && parsedNodes[0].children.length > 0)) {
        // Has hierarchy - use structured paste
        const { nodes: newNodes, rootIds } = parsedNodesToNodeMap(
          parsedNodes,
          currentSelectedNodeId
        );
        pasteNodesFromExternal(currentSelectedNodeId, newNodes, rootIds);
        return;
      }

      // Fallback to plain text paste
      pasteNodesFromText(currentSelectedNodeId, textContent);
    }
  }, [pasteNodes, pasteNodesFromText, pasteNodesFromExternal]);

  // Store refs to callbacks so the menu event listener effect runs only once
  // but still calls the latest version of each callback
  const copyForMiroRef = useRef<() => void>(() => {});
  const performCopyRef = useRef<() => void>(() => {});
  const performCutRef = useRef<() => void>(() => {});
  const performPasteRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});

  // Handle "Copy for Miro" menu event from Tauri
  const copyForMiro = useCallback(() => {
    if (selectedNodeIds.length === 0) return;

    const subtreeNodes: Record<string, typeof nodes[string]> = {};
    for (const nodeId of selectedNodeIds) {
      Object.assign(subtreeNodes, collectSubtree(nodeId));
    }

    // Generate Miro-compatible format (table/TSV)
    const { html: htmlContent, text: textContent } = nodesToMiroFormat(
      subtreeNodes,
      selectedNodeIds
    );

    // Write to system clipboard with both formats
    try {
      const clipboardItems = [
        new ClipboardItem({
          'text/plain': new Blob([textContent], { type: 'text/plain' }),
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
        }),
      ];
      navigator.clipboard.write(clipboardItems).catch(() => {
        navigator.clipboard.writeText(textContent).catch(() => {});
      });
    } catch {
      navigator.clipboard.writeText(textContent).catch(() => {});
    }
  }, [nodes, selectedNodeIds, collectSubtree]);

  // Keep refs updated with latest callbacks
  copyForMiroRef.current = copyForMiro;
  performCopyRef.current = performCopy;
  performCutRef.current = performCut;
  performPasteRef.current = performPaste;
  undoRef.current = undo;
  redoRef.current = redo;

  useEffect(() => {
    // Listen for menu events from Tauri - filter by window label in payload
    // Uses refs so this effect only runs ONCE on mount, preventing duplicate listeners
    // Track if cleanup was called before listeners were set up (React StrictMode)
    let isCancelled = false;
    const unlistenFns: Array<() => void> = [];

    const myLabel = getCurrentWindow().label;
    const listenerPromises = [
      listen<string>('menu-copy-for-miro', (event) => {
        if (!isCancelled && event.payload === myLabel) copyForMiroRef.current();
      }),
      listen<string>('menu-copy', (event) => {
        if (!isCancelled && event.payload === myLabel) performCopyRef.current();
      }),
      listen<string>('menu-cut', (event) => {
        if (!isCancelled && event.payload === myLabel) performCutRef.current();
      }),
      listen<string>('menu-paste', (event) => {
        if (!isCancelled && event.payload === myLabel) performPasteRef.current();
      }),
      listen<string>('menu-undo', (event) => {
        if (!isCancelled && event.payload === myLabel) undoRef.current();
      }),
      listen<string>('menu-redo', (event) => {
        if (!isCancelled && event.payload === myLabel) redoRef.current();
      }),
      listen<string>('menu-create-child', (event) => {
        if (isCancelled || event.payload !== myLabel) return;
        const state = useDocumentStore.getState();
        if (state.selectedNodeId && !state.editingNodeId) {
          state.createChildNode(state.selectedNodeId);
        }
      }),
      listen<string>('menu-create-sibling', (event) => {
        if (isCancelled || event.payload !== myLabel) return;
        const state = useDocumentStore.getState();
        if (state.selectedNodeId && !state.editingNodeId) {
          state.createSiblingNode(state.selectedNodeId);
        }
      }),
      listen<string>('menu-create-sibling-above', (event) => {
        if (isCancelled || event.payload !== myLabel) return;
        const state = useDocumentStore.getState();
        if (state.selectedNodeId && !state.editingNodeId) {
          state.createSiblingNodeAbove(state.selectedNodeId);
        }
      }),
      listen<string>('menu-edit-node', (event) => {
        if (isCancelled || event.payload !== myLabel) return;
        const state = useDocumentStore.getState();
        if (state.selectedNodeId && !state.editingNodeId) {
          state.startEditing(state.selectedNodeId);
        }
      }),
      listen<string>('menu-delete-node', (event) => {
        if (isCancelled || event.payload !== myLabel) return;
        const state = useDocumentStore.getState();
        if (state.selectedNodeId && !state.editingNodeId) {
          state.deleteNode(state.selectedNodeId);
        }
      }),
      listen<string>('menu-toggle-collapse', (event) => {
        if (isCancelled || event.payload !== myLabel) return;
        const state = useDocumentStore.getState();
        if (state.selectedNodeId && !state.editingNodeId) {
          state.toggleCollapse(state.selectedNodeId);
        }
      }),
      listen<string>('menu-toggle-collapse-all', (event) => {
        if (isCancelled || event.payload !== myLabel) return;
        const state = useDocumentStore.getState();
        if (state.selectedNodeId && !state.editingNodeId) {
          state.toggleCollapseAll(state.selectedNodeId);
        }
      }),
      listen<string>('menu-open-icon-picker', (event) => {
        if (isCancelled || event.payload !== myLabel) return;
        const state = useDocumentStore.getState();
        if (state.selectedNodeId && !state.editingNodeId) {
          state.openIconPicker();
        }
      }),
      listen<string>('menu-add-link', (event) => {
        if (isCancelled || event.payload !== myLabel) return;
        const state = useDocumentStore.getState();
        if (state.selectedNodeId && !state.editingNodeId) {
          state.toggleLinkPanel();
        }
      }),
    ];

    // Collect unlisten functions as they resolve
    listenerPromises.forEach((promise) => {
      promise.then((unlistenFn) => {
        if (isCancelled) {
          // Effect was cancelled before this listener resolved - clean up immediately
          unlistenFn();
        } else {
          unlistenFns.push(unlistenFn);
        }
      }).catch(() => {
        // Ignore errors during listener setup
      });
    });

    return () => {
      isCancelled = true;
      // Clean up any listeners that have been set up
      unlistenFns.forEach((fn) => {
        try {
          fn();
        } catch {
          // Ignore errors during cleanup
        }
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - runs only once on mount, uses refs for latest callbacks
};
