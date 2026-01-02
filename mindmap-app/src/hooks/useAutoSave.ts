import { useEffect, useRef } from 'react';
import { useDocumentStore } from '../store';
import { saveDocument } from '../services/tauri/fileSystem';

const AUTOSAVE_DELAY_MS = 1000; // 1 second

export const useAutoSave = () => {
  const nodes = useDocumentStore((state) => state.nodes);
  const rootId = useDocumentStore((state) => state.rootId);
  const currentFilePath = useDocumentStore((state) => state.currentFilePath);
  const isDirty = useDocumentStore((state) => state.isDirty);
  const markClean = useDocumentStore((state) => state.markClean);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    // Only autosave if:
    // 1. There's an existing file path (don't trigger Save As dialog)
    // 2. The document has unsaved changes
    if (!currentFilePath || !isDirty) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up new autosave timeout
    timeoutRef.current = setTimeout(async () => {
      // Prevent concurrent saves
      if (isSavingRef.current) {
        return;
      }

      isSavingRef.current = true;

      try {
        const result = await saveDocument(nodes, rootId, currentFilePath);
        if (result.success) {
          markClean();
          console.log('Autosaved successfully');
        } else {
          console.error('Autosave failed:', result.error);
        }
      } finally {
        isSavingRef.current = false;
      }
    }, AUTOSAVE_DELAY_MS);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [nodes, rootId, currentFilePath, isDirty, markClean]);
};
