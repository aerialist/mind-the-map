/**
 * Workflowy API type definitions
 *
 * Based on the Workflowy API documentation:
 * https://beta.workflowy.com/api-reference/
 */

// ============================================================================
// Node Types
// ============================================================================

/**
 * Layout modes supported by Workflowy nodes
 */
export type WorkflowyLayoutMode =
  | 'bullets'
  | 'todo'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'code-block'
  | 'quote-block';

/**
 * Node data containing layout information
 */
export interface WorkflowyNodeData {
  layoutMode?: WorkflowyLayoutMode;
}

/**
 * A Workflowy node as returned by the API
 */
export interface WorkflowyNode {
  /** Unique identifier (UUID format) */
  id: string;

  /** Parent node ID, or null for root-level nodes */
  parent_id: string | null;

  /** Main bullet text (supports markdown formatting) */
  name: string;

  /** Extended description/note (supports markdown formatting) */
  note: string | null;

  /** Sort order among siblings (lower = earlier) */
  priority: number;

  /** Additional node data */
  data: WorkflowyNodeData;

  /** Unix timestamp of creation */
  createdAt: number;

  /** Unix timestamp of last modification */
  modifiedAt: number;

  /** Unix timestamp of completion, or null if not completed */
  completedAt: number | null;
}

// ============================================================================
// API Request Types
// ============================================================================

/**
 * Parent ID can be a node UUID, a target key, or "None" for top-level
 */
export type WorkflowyParentId = string | 'home' | 'inbox' | 'None';

/**
 * Position when creating or moving nodes
 */
export type WorkflowyPosition = 'top' | 'bottom';

/**
 * Request body for creating a node
 */
export interface CreateNodeRequest {
  parent_id: WorkflowyParentId;
  name: string;
  note?: string;
  position?: WorkflowyPosition;
}

/**
 * Request body for updating a node
 */
export interface UpdateNodeRequest {
  name?: string;
  note?: string;
}

/**
 * Request body for moving a node
 */
export interface MoveNodeRequest {
  parent_id: WorkflowyParentId;
  position: WorkflowyPosition;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from creating a node
 */
export interface CreateNodeResponse {
  item_id: string;
}

/**
 * Response from update/delete operations
 */
export interface StatusResponse {
  status: 'ok';
}

/**
 * Response from getting a single node
 */
export interface GetNodeResponse {
  node: WorkflowyNode;
}

/**
 * Response from listing nodes
 */
export interface ListNodesResponse {
  nodes: WorkflowyNode[];
}

/**
 * Response from nodes export
 */
export interface ExportNodesResponse {
  nodes: WorkflowyNode[];
}

/**
 * Target information from targets endpoint
 */
export interface WorkflowyTarget {
  key: string;
  name: string;
}

/**
 * Response from targets endpoint
 */
export interface TargetsResponse {
  targets: WorkflowyTarget[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Workflowy API error
 */
export interface WorkflowyApiError {
  error: string;
  message?: string;
  statusCode?: number;
}

/**
 * Custom error class for Workflowy API errors
 */
export class WorkflowyError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public apiError?: string
  ) {
    super(message);
    this.name = 'WorkflowyError';
  }
}

// ============================================================================
// Tree Building Types (for reconstructing hierarchy from flat list)
// ============================================================================

/**
 * A Workflowy node with its children populated (for tree representation)
 */
export interface WorkflowyTreeNode extends WorkflowyNode {
  children: WorkflowyTreeNode[];
}
