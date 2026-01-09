import { useEffect, useCallback } from 'react';
import { useDocumentStore } from '../store';
import { dispatch } from '../services/commandBus';

export const useFileOperations = () => {
  const currentFilePath = useDocumentStore((state) => state.currentFilePath);
  const isDirty = useDocumentStore((state) => state.isDirty);

  // Save handler - saves to existing path or shows Save As dialog
  const handleSave = useCallback(() => {
    dispatch('file.save');
  }, []);

  // Save As handler - always shows dialog
  const handleSaveAs = useCallback(() => {
    dispatch('file.saveAs');
  }, []);

  // Open handler
  const handleOpen = useCallback(() => {
    dispatch('file.open');
  }, []);

  // New document handler
  const handleNew = useCallback(() => {
    // TODO: Check for unsaved changes before creating new
    dispatch('file.new');
  }, []);

  // Print/Export PDF handler
  const handlePrint = useCallback(() => {
    dispatch('file.print');
  }, []);

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

        case 'p':
          e.preventDefault();
          handlePrint();
          break;
        case 'e':
          if (e.shiftKey) {
            e.preventDefault();
            handlePrint();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleOpen, handleNew, handlePrint]);

  return {
    handleSave,
    handleSaveAs,
    handleOpen,
    handleNew,
    handlePrint,
    isDirty,
    currentFilePath,
  };
};
