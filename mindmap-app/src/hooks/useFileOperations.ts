import { useEffect, useCallback } from 'react';
import { useDocumentStore } from '../store';
import {
  saveDocument,
  saveDocumentAs,
  openDocument,
} from '../services/tauri/fileSystem';

export const useFileOperations = () => {
  const nodes = useDocumentStore((state) => state.nodes);
  const rootId = useDocumentStore((state) => state.rootId);
  const currentFilePath = useDocumentStore((state) => state.currentFilePath);
  const isDirty = useDocumentStore((state) => state.isDirty);
  const setFilePath = useDocumentStore((state) => state.setFilePath);
  const markClean = useDocumentStore((state) => state.markClean);
  const loadDocument = useDocumentStore((state) => state.loadDocument);
  const newDocument = useDocumentStore((state) => state.newDocument);

  // Save handler - saves to existing path or shows Save As dialog
  const handleSave = useCallback(async () => {
    if (currentFilePath) {
      const result = await saveDocument(nodes, rootId, currentFilePath);
      if (result.success) {
        markClean();
      } else {
        console.error('Save failed:', result.error);
      }
    } else {
      const result = await saveDocumentAs(nodes, rootId);
      if (result.success && result.path) {
        setFilePath(result.path);
        markClean();
      } else if (result.error !== 'Save cancelled') {
        console.error('Save failed:', result.error);
      }
    }
  }, [nodes, rootId, currentFilePath, setFilePath, markClean]);

  // Save As handler - always shows dialog
  const handleSaveAs = useCallback(async () => {
    const result = await saveDocumentAs(nodes, rootId);
    if (result.success && result.path) {
      setFilePath(result.path);
      markClean();
    } else if (result.error !== 'Save cancelled') {
      console.error('Save failed:', result.error);
    }
  }, [nodes, rootId, setFilePath, markClean]);

  // Open handler
  const handleOpen = useCallback(async () => {
    // TODO: Check for unsaved changes before opening
    const result = await openDocument();
    if (result.success && result.nodes && result.rootId) {
      loadDocument(result.nodes, result.rootId, result.path || null);
    } else if (result.error !== 'Open cancelled') {
      console.error('Open failed:', result.error);
    }
  }, [loadDocument]);

  // New document handler
  const handleNew = useCallback(() => {
    // TODO: Check for unsaved changes before creating new
    newDocument();
  }, [newDocument]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl (Windows/Linux) or Cmd (Mac)
      const isMod = e.ctrlKey || e.metaKey;

      if (!isMod) return;

      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          if (e.shiftKey) {
            handleSaveAs();
          } else {
            handleSave();
          }
          break;

        case 'o':
          e.preventDefault();
          handleOpen();
          break;

        case 'n':
          e.preventDefault();
          handleNew();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleOpen, handleNew]);

  return {
    handleSave,
    handleSaveAs,
    handleOpen,
    handleNew,
    isDirty,
    currentFilePath,
  };
};
