import { useEffect, useRef } from 'react';
import { useDocumentStore } from '../store';
import { openDocumentByPath } from '../services/tauri/fileSystem';

/**
 * Hook to load a file from URL query parameter on app initialization.
 * Used when opening a .mindmap file link in a new window.
 */
export const useInitialFileLoad = () => {
  const loadDocument = useDocumentStore((state) => state.loadDocument);
  const hasLoaded = useRef(false);

  useEffect(() => {
    // Only run once on mount
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    const loadFileFromUrl = async () => {
      // Parse URL query parameters
      const params = new URLSearchParams(window.location.search);
      const filePath = params.get('file');

      if (!filePath) return;

      // Decode the file path
      const decodedPath = decodeURIComponent(filePath);

      // Load the file
      const result = await openDocumentByPath(decodedPath);
      if (result.success && result.nodes && result.rootId) {
        loadDocument(result.nodes, result.rootId, result.path || null);
      } else {
        console.error('Failed to load file from link:', result.error);
      }
    };

    loadFileFromUrl();
  }, [loadDocument]);
};
