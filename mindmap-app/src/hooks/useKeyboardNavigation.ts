import { useEffect } from 'react';
import { useDocumentStore } from '../store';
import {
  getNextNodeId,
  getPreviousNodeId,
  getParentNodeId,
  getFirstChildNodeId,
} from '../core/navigation';

export const useKeyboardNavigation = () => {
  const nodes = useDocumentStore((state) => state.nodes);
  const rootId = useDocumentStore((state) => state.rootId);
  const selectedNodeId = useDocumentStore((state) => state.selectedNodeId);
  const editingNodeId = useDocumentStore((state) => state.editingNodeId);
  const selectNode = useDocumentStore((state) => state.selectNode);
  const startEditing = useDocumentStore((state) => state.startEditing);
  const createChildNode = useDocumentStore((state) => state.createChildNode);
  const deleteNode = useDocumentStore((state) => state.deleteNode);
  const toggleCollapse = useDocumentStore((state) => state.toggleCollapse);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
          nextNodeId = getPreviousNodeId(nodes, rootId, selectedNodeId);
          break;

        case 'ArrowDown':
          e.preventDefault();
          nextNodeId = getNextNodeId(nodes, rootId, selectedNodeId);
          break;

        case 'ArrowLeft':
          e.preventDefault();
          // Go to parent
          nextNodeId = getParentNodeId(nodes, selectedNodeId);
          break;

        case 'ArrowRight':
          e.preventDefault();
          // Go to first child (if exists and expanded)
          nextNodeId = getFirstChildNodeId(nodes, selectedNodeId);
          break;

        case 'Enter':
        case 'F2':
          e.preventDefault();
          // Start editing the selected node
          startEditing(selectedNodeId);
          break;

        case 'Tab':
          e.preventDefault();
          // Create a child node
          createChildNode(selectedNodeId);
          break;

        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          // Delete the selected node (won't delete root)
          deleteNode(selectedNodeId);
          break;

        case ' ':
          e.preventDefault();
          // Toggle collapse/expand for the selected node
          toggleCollapse(selectedNodeId);
          break;
      }

      if (nextNodeId) {
        selectNode(nextNodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, rootId, selectedNodeId, editingNodeId, selectNode, startEditing, createChildNode, deleteNode, toggleCollapse]);
};
