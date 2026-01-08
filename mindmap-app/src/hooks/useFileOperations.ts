import { useEffect, useCallback } from 'react';
import { useDocumentStore } from '../store';
import {
  saveDocument,
  saveDocumentAs,
  openDocument,
} from '../services/tauri/fileSystem';
import { exportToPDF } from '../services/pdfExport';
import { computeVisibleNodeIds } from '../store';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

export const useFileOperations = () => {
  const nodes = useDocumentStore((state) => state.nodes);
  const rootId = useDocumentStore((state) => state.rootId);
  const currentFilePath = useDocumentStore((state) => state.currentFilePath);
  const isDirty = useDocumentStore((state) => state.isDirty);
  const setFilePath = useDocumentStore((state) => state.setFilePath);
  const markClean = useDocumentStore((state) => state.markClean);
  const loadDocument = useDocumentStore((state) => state.loadDocument);
  const newDocument = useDocumentStore((state) => state.newDocument);
  const viewMode = useDocumentStore((state) => state.viewMode);
  const activeIconFilters = useDocumentStore((state) => state.activeIconFilters);
  const hiddenIconFilters = useDocumentStore((state) => state.hiddenIconFilters);

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

  // Print/Export PDF handler
  const handlePrint = useCallback(async () => {
    const visibleNodeIds = computeVisibleNodeIds(nodes, rootId, activeIconFilters, hiddenIconFilters);
    const result = await exportToPDF(viewMode, nodes, rootId, visibleNodeIds, currentFilePath);
    if (!result.success && result.error !== 'Save cancelled') {
      console.error('PDF export failed:', result.error);
    }
  }, [nodes, rootId, viewMode, activeIconFilters, hiddenIconFilters, currentFilePath]);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleOpen, handleNew, handlePrint]);

  // Listen for Tauri menu events - filter by window label in payload
  useEffect(() => {
    let isCancelled = false;
    const unlistenFns: Array<() => void> = [];

    const myLabel = getCurrentWindow().label;

    // Use global listen but filter by target label in payload
    const listenerPromises = [
      listen<string>('menu-new', (event) => {
        if (!isCancelled && event.payload === myLabel) {
          handleNew();
        }
      }),
      listen<string>('menu-open', (event) => {
        if (!isCancelled && event.payload === myLabel) {
          handleOpen();
        }
      }),
      listen<string>('menu-save', (event) => {
        if (!isCancelled && event.payload === myLabel) {
          handleSave();
        }
      }),
      listen<string>('menu-save-as', (event) => {
        if (!isCancelled && event.payload === myLabel) {
          handleSaveAs();
        }
      }),
      listen<string>('menu-print', (event) => {
        if (!isCancelled && event.payload === myLabel) {
          handlePrint();
        }
      }),
    ];

    listenerPromises.forEach((promise) => {
      promise.then((unlistenFn) => {
        if (isCancelled) {
          unlistenFn();
        } else {
          unlistenFns.push(unlistenFn);
        }
      }).catch(() => {});
    });

    return () => {
      isCancelled = true;
      unlistenFns.forEach((fn) => { try { fn(); } catch {} });
    };
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handlePrint]);

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
