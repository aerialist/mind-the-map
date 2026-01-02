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

export interface Node {
  id: string;
  parentId: string | null;
  childIds: string[];
  content: NodeContent;
  position: Position;
  isCollapsed: boolean;
  icons?: NodeIcon[]; // Optional array of icons for the node
  link?: string; // Optional link (URL or file path)
}

export type NodeMap = Record<string, Node>;
