// Node-related type definitions

import type { NodeIcon } from './icons';

export interface Position {
  x: number;
  y: number;
  source: 'auto' | 'manual'; // Track whether position was set manually or auto-calculated
}

export type NodeContent =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }; // Future: support for images

export interface WorkflowySyncMetadata {
  workflowyId: string; // Original Workflowy node ID
  lastSyncedAt: number; // Unix timestamp of last sync
  lastModifiedAt: number; // Workflowy's modifiedAt timestamp
  conflict?: boolean; // Conflict detected during push/pull
}

export interface Node {
  id: string;
  parentId: string | null;
  childIds: string[];
  content: NodeContent;
  position: Position;
  isCollapsed: boolean;
  icons?: NodeIcon[]; // Optional array of icons for the node
  link?: string; // Optional link (URL or file path)
  workflowySync?: WorkflowySyncMetadata; // Workflowy sync metadata (if imported from Workflowy)
  workflowyConflict?: boolean; // Local-only Workflowy conflict marker
}

export type NodeMap = Record<string, Node>;
