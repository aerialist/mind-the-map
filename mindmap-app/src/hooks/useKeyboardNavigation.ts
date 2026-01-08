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
import { dispatch, registerCommandHandler } from '../services/commandBus';

export const useKeyboardNavigation = () => {
  const nodes = useDocumentStore((state) => state.nodes);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const selectedNodeIds = useDocumentStore((state) => state.selectedNodeIds);
  const editingNodeId = useDocumentStore((state) => state.editingNodeId);

  // Track the last text we wrote to system clipboard
  // Used to detect if user copied something externally
  const lastWrittenClipboardTextRef = useRef<string | null>(null);
  const updateNodeText = useDocumentStore((state) => state.updateNodeText);
  const copyNodes = useDocumentStore((state) => state.copyNodes);
  const cutNodes = useDocumentStore((state) => state.cutNodes);
  const pasteNodes = useDocumentStore((state) => state.pasteNodes);
  const pasteNodesFromText = useDocumentStore((state) => state.pasteNodesFromText);
  const pasteNodesFromExternal = useDocumentStore(
    (state) => state.pasteNodesFromExternal
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle undo/redo globally (even during editing)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          dispatch('edit.redo');
        } else {
          dispatch('edit.undo');
        }
        return;
      }

      // Alternative redo shortcut: Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        dispatch('edit.redo');
        return;
      }

      // Note: Copy/Cut/Paste (Cmd+C/X/V) are handled via the command bus

      // Copy for Miro (Ctrl+Shift+M) - exports as table format for Miro's paste dialog
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        if (!editingNodeId && selectedNodeIds.length > 0) {
          e.preventDefault();
          dispatch('edit.copyForMiro');
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        // Cut - only when not editing and has selection (excluding root)
        if (!editingNodeId && selectedNodeIds.length > 0) {
          e.preventDefault();
          dispatch('edit.cut');
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

      // Handle indent/outdent globally (even during editing)
      if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        if (selectedNodeId) {
          e.preventDefault();
          // If editing, save the current text from the input element first
          if (editingNodeId === selectedNodeId) {
            const inputElement = document.querySelector(`input[type="text"]:focus`) as HTMLInputElement;
            if (inputElement) {
              updateNodeText(selectedNodeId, inputElement.value);
            }
          }
          dispatch('node.indent', { nodeId: selectedNodeId });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        if (selectedNodeId) {
          e.preventDefault();
          // If editing, save the current text from the input element first
          if (editingNodeId === selectedNodeId) {
            const inputElement = document.querySelector(`input[type="text"]:focus`) as HTMLInputElement;
            if (inputElement) {
              updateNodeText(selectedNodeId, inputElement.value);
            }
          }
          dispatch('node.outdent', { nodeId: selectedNodeId });
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
              dispatch('node.toggleCollapse', { nodeId: selectedNodeId });
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
            dispatch('node.createSiblingAbove', { nodeId: selectedNodeId });
          } else {
            // Create a sibling node below
            dispatch('node.createSibling', { nodeId: selectedNodeId });
          }
          break;

        case 'Tab':
          e.preventDefault();
          // Create a child node
          dispatch('node.createChild', { nodeId: selectedNodeId });
          break;

        case 'e':
        case 'E':
        case 'F2':
          e.preventDefault();
          // Start editing the selected node
          dispatch('node.edit', { nodeId: selectedNodeId });
          break;

        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          // Delete the selected node (won't delete root)
          dispatch('node.delete', { nodeId: selectedNodeId });
          break;

        case ' ':
        case '\u00A0': // Non-breaking space (produced by Option+Space on macOS)
          e.preventDefault();
          if (e.shiftKey && e.altKey) {
            // Toggle collapse/expand all children recursively (Shift+Alt+Space)
            dispatch('node.toggleCollapseAll', { nodeId: selectedNodeId });
          } else {
            // Toggle collapse/expand for the selected node
            dispatch('node.toggleCollapse', { nodeId: selectedNodeId });
          }
          break;

        case 'i':
        case 'I':
          e.preventDefault();
          // Open icon picker (uses currently selected node)
          dispatch('node.openIconPicker');
          break;
      }

      if (nextNodeId) {
        dispatch('node.select', { nodeId: nextNodeId });
      }
    };

    // Note: Paste is handled via the command bus (edit.paste) which calls performPaste()
    // This avoids duplicate handling and permission issues with clipboard API

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, selectedNodeId, selectedNodeIds, editingNodeId, updateNodeText]);

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

    // Store the text for internal/external paste detection
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
  }, [nodes, selectedNodeIds, collectSubtree]);

  // Keep refs updated with latest callbacks
  copyForMiroRef.current = copyForMiro;
  performCopyRef.current = performCopy;
  performCutRef.current = performCut;
  performPasteRef.current = performPaste;

  useEffect(() => {
    const unregisters = [
      registerCommandHandler('edit.copyForMiro', () => copyForMiroRef.current()),
      registerCommandHandler('edit.copy', () => performCopyRef.current()),
      registerCommandHandler('edit.cut', () => performCutRef.current()),
      registerCommandHandler('edit.paste', () => {
        void performPasteRef.current();
      }),
    ];

    return () => {
      unregisters.forEach((unregister) => {
        try {
          unregister();
        } catch {}
      });
    };
  }, []);
};
