// Tauri file system operations

import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
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
