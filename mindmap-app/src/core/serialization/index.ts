// Serialization utilities for saving/loading documents

import type { Node, NodeMap } from '../../types';

// File format version for future compatibility
const FILE_VERSION = '1.0.0';

// Document file format
export interface MindMapFile {
  version: string;
  metadata: {
    title: string;
    createdAt: string;
    modifiedAt: string;
  };
  rootId: string;
  nodes: NodeMap;
}

// Serialize document state to file format
export const serialize = (
  nodes: NodeMap,
  rootId: string,
  title: string = 'Untitled'
): string => {
  const file: MindMapFile = {
    version: FILE_VERSION,
    metadata: {
      title,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    },
    rootId,
    nodes,
  };

  return JSON.stringify(file, null, 2);
};

// Deserialize file content to document state
export const deserialize = (
  content: string
): { nodes: NodeMap; rootId: string; title: string } => {
  const file = JSON.parse(content) as MindMapFile;

  // Version check for future compatibility
  if (!file.version) {
    throw new Error('Invalid file format: missing version');
  }

  // Validate required fields
  if (!file.rootId || !file.nodes) {
    throw new Error('Invalid file format: missing required fields');
  }

  // Validate root node exists
  if (!file.nodes[file.rootId]) {
    throw new Error('Invalid file format: root node not found');
  }

  return {
    nodes: file.nodes,
    rootId: file.rootId,
    title: file.metadata?.title || 'Untitled',
  };
};

// Get root node text as document title
export const getDocumentTitle = (nodes: NodeMap, rootId: string): string => {
  const root = nodes[rootId];
  if (root && root.content.type === 'text') {
    return root.content.text || 'Untitled';
  }
  return 'Untitled';
};
