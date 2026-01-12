import { useEffect, useRef } from 'react';
import { useDocumentStore } from '../store';
import { useSettingsStore } from '../store/settingsStore';
import { saveDocument } from '../services/tauri/fileSystem';

export const useAutoSave = () => {
  const nodes = useDocumentStore((state) => state.nodes);
  const rootId = useDocumentStore((state) => state.rootId);
  const currentFilePath = useDocumentStore((state) => state.currentFilePath);
  const isDirty = useDocumentStore((state) => state.isDirty);
  const markClean = useDocumentStore((state) => state.markClean);

  // Get auto-save settings
  const autoSaveEnabled = useSettingsStore((state) => state.settings.general.autoSaveEnabled);
  const autoSaveIntervalMs = useSettingsStore((state) => state.settings.general.autoSaveIntervalMs);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    // Only autosave if:
    // 1. Auto-save is enabled in settings
    // 2. There's an existing file path (don't trigger Save As dialog)
    // 3. The document has unsaved changes
    if (!autoSaveEnabled || !currentFilePath || !isDirty) {
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
    }, autoSaveIntervalMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [nodes, rootId, currentFilePath, isDirty, markClean, autoSaveEnabled, autoSaveIntervalMs]);
};
