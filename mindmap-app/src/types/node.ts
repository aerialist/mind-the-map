// Node-related type definitions

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
}

export type NodeMap = Record<string, Node>;
