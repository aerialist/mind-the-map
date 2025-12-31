// Document-related type definitions

import { NodeMap } from './node';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type ViewMode = 'mindmap' | 'outline';

export interface DocumentMetadata {
  title: string;
  created: string;
  modified: string;
}

export interface DocumentView {
  mode: ViewMode;
  viewport: Viewport;
  outlineScrollPosition: number;
}

export interface Document {
  version: string;
  metadata: DocumentMetadata;
  view: DocumentView;
  rootId: string;
  nodes: NodeMap;
}
