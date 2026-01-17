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
  lastSyncedParentId?: string | null; // Workflowy parent ID at last sync
  lastSyncedPosition?: 'top' | 'bottom'; // Position at last sync (approximate)
  lastSyncedSiblingIndex?: number; // Index among synced siblings at last sync
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
  note?: string; // Optional extended note/description (supports inline formatting)
  workflowySync?: WorkflowySyncMetadata; // Workflowy sync metadata (if imported from Workflowy)
  workflowyConflict?: boolean; // Local-only Workflowy conflict marker
  workflowyModified?: boolean; // Node modified locally since last sync (needs push)
}

export type NodeMap = Record<string, Node>;
