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
  const clipboard = useDocumentStore((state) => state.clipboard);
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
  const openLinkDialog = useDocumentStore((state) => state.openLinkDialog);
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

      // Handle copy/cut/paste globally (even during editing for paste)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        // Copy - only when not editing and has selection
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

          copyNodes(selectedNodeIds);
        }
        return;
      }

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

    // Handle paste event - this gives us access to clipboardData without permission prompts
    const handlePaste = (e: ClipboardEvent) => {
      // Skip if editing or no target selected
      if (editingNodeId || !selectedNodeId) return;

      // Skip if user is in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      e.preventDefault();

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const hasInternalClipboard = clipboard && clipboard.rootIds.length > 0;
      const htmlContent = clipboardData.getData('text/html');
      const textContent = clipboardData.getData('text/plain');

      // Check if content differs from what we last wrote
      const systemTextDiffersFromLastWrite =
        textContent &&
        textContent.trim() &&
        textContent !== lastWrittenClipboardTextRef.current;

      if (systemTextDiffersFromLastWrite) {
        // User copied something externally - try to parse HTML first
        if (htmlContent) {
          const parsedNodes = parseHtmlToNodes(htmlContent);
          if (parsedNodes.length > 0) {
            // Successfully parsed HTML structure
            const { nodes: newNodes, rootIds } = parsedNodesToNodeMap(
              parsedNodes,
              selectedNodeId
            );
            pasteNodesFromExternal(selectedNodeId, newNodes, rootIds);
            return;
          }
        }

        // Try parsing indented text
        if (textContent) {
          const parsedNodes = parseIndentedTextToNodes(textContent);
          if (parsedNodes.length > 1 || (parsedNodes.length === 1 && parsedNodes[0].children.length > 0)) {
            // Has hierarchy - use structured paste
            const { nodes: newNodes, rootIds } = parsedNodesToNodeMap(
              parsedNodes,
              selectedNodeId
            );
            pasteNodesFromExternal(selectedNodeId, newNodes, rootIds);
            return;
          }
        }

        // Fallback to plain text paste
        if (textContent && textContent.trim()) {
          pasteNodesFromText(selectedNodeId, textContent);
        }
      } else if (hasInternalClipboard) {
        // Use internal clipboard (node copy/cut)
        pasteNodes(selectedNodeId);
      } else if (textContent && textContent.trim()) {
        // Fallback: use system clipboard text
        pasteNodesFromText(selectedNodeId, textContent);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [nodes, selectedNodeId, selectedNodeIds, editingNodeId, clipboard, selectNode, startEditing, createChildNode, createSiblingNode, createSiblingNodeAbove, deleteNode, toggleCollapse, toggleCollapseAll, openIconPicker, copyNodes, cutNodes, pasteNodes, pasteNodesFromText, pasteNodesFromExternal, undo, redo]);

  // Handle "Copy for Miro" menu event from Tauri
  const copyForMiro = useCallback(() => {
    if (selectedNodeIds.length === 0) return;

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
  }, [nodes, selectedNodeIds]);

  useEffect(() => {
    // Listen for menu events from Tauri - filter by window label in payload
    const myLabel = getCurrentWindow().label;
    const listeners = [
      listen<string>('menu-copy-for-miro', (event) => {
        if (event.payload === myLabel) copyForMiro();
      }),
      listen<string>('menu-create-child', (event) => {
        if (event.payload === myLabel && selectedNodeId && !editingNodeId) {
          createChildNode(selectedNodeId);
        }
      }),
      listen<string>('menu-create-sibling', (event) => {
        if (event.payload === myLabel && selectedNodeId && !editingNodeId) {
          createSiblingNode(selectedNodeId);
        }
      }),
      listen<string>('menu-create-sibling-above', (event) => {
        if (event.payload === myLabel && selectedNodeId && !editingNodeId) {
          createSiblingNodeAbove(selectedNodeId);
        }
      }),
      listen<string>('menu-edit-node', (event) => {
        if (event.payload === myLabel && selectedNodeId && !editingNodeId) {
          startEditing(selectedNodeId);
        }
      }),
      listen<string>('menu-delete-node', (event) => {
        if (event.payload === myLabel && selectedNodeId && !editingNodeId) {
          deleteNode(selectedNodeId);
        }
      }),
      listen<string>('menu-toggle-collapse', (event) => {
        if (event.payload === myLabel && selectedNodeId && !editingNodeId) {
          toggleCollapse(selectedNodeId);
        }
      }),
      listen<string>('menu-toggle-collapse-all', (event) => {
        if (event.payload === myLabel && selectedNodeId && !editingNodeId) {
          toggleCollapseAll(selectedNodeId);
        }
      }),
      listen<string>('menu-open-icon-picker', (event) => {
        if (event.payload === myLabel && selectedNodeId && !editingNodeId) {
          openIconPicker();
        }
      }),
      listen<string>('menu-add-link', (event) => {
        if (event.payload === myLabel && selectedNodeId && !editingNodeId) {
          openLinkDialog();
        }
      }),
    ];

    return () => {
      listeners.forEach((unlisten) => unlisten.then((fn) => fn()));
    };
  }, [copyForMiro, selectedNodeId, editingNodeId, createChildNode, createSiblingNode, createSiblingNodeAbove, startEditing, deleteNode, toggleCollapse, toggleCollapseAll, openIconPicker, openLinkDialog]);
};
