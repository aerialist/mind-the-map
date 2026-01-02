// Tauri file system operations

import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { openUrl, openPath } from '@tauri-apps/plugin-opener';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { NodeMap } from '../../types';
import { serialize, deserialize, getDocumentTitle } from '../../core/serialization';

// File extension for mind map files
const FILE_EXTENSION = 'mindmap';
const FILE_FILTER = {
  name: 'Mind Map',
  extensions: [FILE_EXTENSION],
};

export interface SaveResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface OpenResult {
  success: boolean;
  nodes?: NodeMap;
  rootId?: string;
  title?: string;
  path?: string;
  error?: string;
}

// Save document with "Save As" dialog
export const saveDocumentAs = async (
  nodes: NodeMap,
  rootId: string
): Promise<SaveResult> => {
  try {
    // Get title from root node
    const title = getDocumentTitle(nodes, rootId);

    // Show save dialog
    const path = await save({
      defaultPath: `${title}.${FILE_EXTENSION}`,
      filters: [FILE_FILTER],
    });

    if (!path) {
      return { success: false, error: 'Save cancelled' };
    }

    // Serialize and save
    const content = serialize(nodes, rootId, title);
    await invoke('save_document', { path, content });

    return { success: true, path };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Save document to existing path
export const saveDocument = async (
  nodes: NodeMap,
  rootId: string,
  path: string
): Promise<SaveResult> => {
  try {
    const title = getDocumentTitle(nodes, rootId);
    const content = serialize(nodes, rootId, title);
    await invoke('save_document', { path, content });

    return { success: true, path };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Open document with file dialog
export const openDocument = async (): Promise<OpenResult> => {
  try {
    // Show open dialog
    const path = await open({
      multiple: false,
      filters: [FILE_FILTER],
    });

    if (!path) {
      return { success: false, error: 'Open cancelled' };
    }

    // Read and deserialize
    const content = await invoke<string>('read_document', { path });
    const { nodes, rootId, title } = deserialize(content);

    return { success: true, nodes, rootId, title, path };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Determine link type
export const getLinkType = (link: string): 'url' | 'mindmap' | 'file' => {
  if (!link) return 'url';
  if (link.startsWith('http://') || link.startsWith('https://')) return 'url';
  if (link.endsWith('.mindmap')) return 'mindmap';
  return 'file';
};

// Open a link (URL, file path, or mindmap file)
export const openLink = async (link: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const linkType = getLinkType(link);

    if (linkType === 'url') {
      // Open URL in default browser
      await openUrl(link);
    } else if (linkType === 'mindmap') {
      // Open .mindmap file in a new app window
      const label = `mindmap-${Date.now()}`;
      const webview = new WebviewWindow(label, {
        url: `index.html?file=${encodeURIComponent(link)}`,
        title: 'Mind the Map',
        width: 1200,
        height: 800,
      });

      // Wait for the window to be created
      webview.once('tauri://created', () => {
        // Window created successfully
      });

      webview.once('tauri://error', (e) => {
        console.error('Failed to create window:', e);
      });
    } else {
      // Open file with default application
      await openPath(link);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
