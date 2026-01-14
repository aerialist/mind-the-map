/**
 * Workflowy API Client
 *
 * A typed client for the Workflowy REST API.
 * API Documentation: https://beta.workflowy.com/api-reference/
 *
 * Uses Tauri's HTTP proxy to avoid CORS restrictions.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  WorkflowyNode,
  WorkflowyTreeNode,
  CreateNodeRequest,
  CreateNodeResponse,
  UpdateNodeRequest,
  MoveNodeRequest,
  StatusResponse,
  GetNodeResponse,
  ListNodesResponse,
  ExportNodesResponse,
  TargetsResponse,
  WorkflowyParentId,
  WorkflowyPosition,
} from './types';
import { WorkflowyError } from './types';

const BASE_URL = 'https://workflowy.com/api/v1';

/**
 * Response from Tauri's http_request command
 */
interface TauriHttpResponse {
  status: number;
  body: string;
}

/**
 * Workflowy API Client
 */
export class WorkflowyClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new WorkflowyError('API key is required');
    }
    this.apiKey = apiKey;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async request<T>(
    endpoint: string,
    options: { method?: string; body?: string } = {}
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const method = options.method || 'GET';

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      // Use Tauri's HTTP proxy to avoid CORS
      const response = await invoke<TauriHttpResponse>('http_request', {
        request: {
          url,
          method,
          headers,
          body: options.body || null,
        },
      });

      if (response.status >= 400) {
        let errorMessage = `Workflowy API error: ${response.status}`;
        let apiError: string | undefined;

        try {
          const errorBody = JSON.parse(response.body);
          if (errorBody.error) {
            apiError = errorBody.error;
            errorMessage = `Workflowy API error: ${errorBody.error}`;
          }
        } catch {
          // Ignore JSON parse errors
        }

        throw new WorkflowyError(errorMessage, response.status, apiError);
      }

      // Handle empty responses (some endpoints may return empty body with 200)
      if (!response.body) {
        return {} as T;
      }

      try {
        return JSON.parse(response.body) as T;
      } catch {
        throw new WorkflowyError('Failed to parse API response');
      }
    } catch (error) {
      if (error instanceof WorkflowyError) {
        throw error;
      }
      throw new WorkflowyError(`HTTP request failed: ${error}`);
    }
  }

  // ==========================================================================
  // Node CRUD Operations
  // ==========================================================================

  /**
   * Create a new node
   *
   * @param parentId - Parent node ID, target key ('home', 'inbox'), or 'None' for top-level
   * @param name - Node text (supports markdown)
   * @param options - Optional note and priority
   * @returns The created node's ID
   */
  async createNode(
    parentId: WorkflowyParentId,
    name: string,
    options?: { note?: string; position?: WorkflowyPosition }
  ): Promise<string> {
    const body: CreateNodeRequest = {
      parent_id: parentId,
      name,
      ...options,
    };

    const response = await this.request<CreateNodeResponse>('/nodes', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return response.item_id;
  }

  /**
   * Get a single node by ID
   *
   * @param nodeId - The node ID to retrieve
   * @returns The node data
   */
  async getNode(nodeId: string): Promise<WorkflowyNode> {
    const response = await this.request<GetNodeResponse>(`/nodes/${nodeId}`);
    return response.node;
  }

  /**
   * List child nodes of a parent
   *
   * Note: Nodes are returned unordered - sort by priority field if needed.
   *
   * @param parentId - Parent node ID or target key
   * @returns Array of child nodes (unordered)
   */
  async listNodes(parentId: WorkflowyParentId): Promise<WorkflowyNode[]> {
    const response = await this.request<ListNodesResponse>(
      `/nodes?parent_id=${encodeURIComponent(parentId)}`
    );
    return response.nodes || [];
  }

  /**
   * Update a node's name and/or note
   *
   * @param nodeId - The node ID to update
   * @param updates - Fields to update
   */
  async updateNode(
    nodeId: string,
    updates: UpdateNodeRequest
  ): Promise<void> {
    await this.request<StatusResponse>(`/nodes/${nodeId}`, {
      method: 'POST',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a node permanently
   *
   * WARNING: This is irreversible!
   *
   * @param nodeId - The node ID to delete
   */
  async deleteNode(nodeId: string): Promise<void> {
    await this.request<StatusResponse>(`/nodes/${nodeId}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // Node Organization
  // ==========================================================================

  /**
   * Move a node to a different parent
   *
   * @param nodeId - The node ID to move
   * @param parentId - New parent ID or target key
   * @param position - 'top' or 'bottom' within new parent
   */
  async moveNode(
    nodeId: string,
    parentId: WorkflowyParentId,
    position: WorkflowyPosition = 'bottom'
  ): Promise<void> {
    const body: MoveNodeRequest = {
      parent_id: parentId,
      position,
    };

    await this.request<StatusResponse>(`/nodes/${nodeId}/move`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Mark a node as completed
   *
   * @param nodeId - The node ID to complete
   */
  async completeNode(nodeId: string): Promise<void> {
    await this.request<StatusResponse>(`/nodes/${nodeId}/complete`, {
      method: 'POST',
    });
  }

  /**
   * Mark a node as incomplete
   *
   * @param nodeId - The node ID to uncomplete
   */
  async uncompleteNode(nodeId: string): Promise<void> {
    await this.request<StatusResponse>(`/nodes/${nodeId}/uncomplete`, {
      method: 'POST',
    });
  }

  // ==========================================================================
  // Bulk Operations
  // ==========================================================================

  /**
   * Export all nodes as a flat list
   *
   * RATE LIMIT: 1 request per minute!
   *
   * @returns Flat array of all nodes (must reconstruct hierarchy using parent_id)
   */
  async exportAllNodes(): Promise<WorkflowyNode[]> {
    const response = await this.request<ExportNodesResponse>('/nodes-export');
    return response.nodes || [];
  }

  /**
   * Get available targets (shortcuts and system targets)
   *
   * @returns List of available targets like 'home', 'inbox', etc.
   */
  async getTargets(): Promise<TargetsResponse> {
    return this.request<TargetsResponse>('/targets');
  }

  // ==========================================================================
  // Tree Building Utilities
  // ==========================================================================

  /**
   * Build a tree structure from a flat list of nodes
   *
   * @param nodes - Flat array of nodes (from exportAllNodes or multiple listNodes calls)
   * @param rootId - Optional root node ID to build tree from (null = build from top-level)
   * @returns Tree structure with children populated
   */
  static buildTree(
    nodes: WorkflowyNode[],
    rootId: string | null = null
  ): WorkflowyTreeNode[] {
    // Create a map for quick lookup
    const nodeMap = new Map<string, WorkflowyTreeNode>();

    // Initialize all nodes with empty children arrays
    for (const node of nodes) {
      nodeMap.set(node.id, { ...node, children: [] });
    }

    // Build the tree by assigning children to parents
    const roots: WorkflowyTreeNode[] = [];

    for (const node of nodes) {
      const treeNode = nodeMap.get(node.id)!;

      if (rootId !== null) {
        // Building from a specific root
        if (node.id === rootId) {
          roots.push(treeNode);
        } else if (node.parent_id) {
          const parent = nodeMap.get(node.parent_id);
          if (parent) {
            parent.children.push(treeNode);
          }
        }
      } else {
        // Building from top-level (parent_id is null)
        if (node.parent_id === null) {
          roots.push(treeNode);
        } else {
          const parent = nodeMap.get(node.parent_id);
          if (parent) {
            parent.children.push(treeNode);
          }
        }
      }
    }

    // Sort all children by priority
    const sortChildren = (node: WorkflowyTreeNode) => {
      node.children.sort((a, b) => a.priority - b.priority);
      node.children.forEach(sortChildren);
    };

    roots.sort((a, b) => a.priority - b.priority);
    roots.forEach(sortChildren);

    return roots;
  }

  /**
   * Build a subtree starting from a specific node ID
   *
   * Fetches all descendants recursively.
   *
   * @param nodeId - Root node ID to start from
   * @returns The subtree with the specified node as root
   */
  async getSubtree(nodeId: string): Promise<WorkflowyTreeNode | null> {
    const allNodes: WorkflowyNode[] = [];

    // Recursive fetch function
    // Note: listNodes API returns parent_id as null, so we fix it here
    const fetchBranch = async (parentId: string) => {
      const children = await this.listNodes(parentId);

      // Fix parent_id since listNodes returns null for all nodes
      const childrenWithParent = children.map((child) => ({
        ...child,
        parent_id: parentId,
      }));
      allNodes.push(...childrenWithParent);

      // Recursively fetch children
      await Promise.all(
        childrenWithParent.map((child) => fetchBranch(child.id))
      );
    };

    // Get the root node first
    const rootNode = await this.getNode(nodeId);
    // Root node should have null parent_id (it's the top of our subtree)
    allNodes.push({ ...rootNode, parent_id: null });

    // Fetch all descendants
    await fetchBranch(nodeId);

    // Build tree from collected nodes
    const trees = WorkflowyClient.buildTree(allNodes, nodeId);
    return trees.length > 0 ? trees[0] : null;
  }

  /**
   * Recursively fetch all nodes under a parent (for partial sync)
   *
   * Unlike exportAllNodes, this can be called more frequently as it uses
   * the regular listNodes endpoint.
   *
   * @param parentId - Parent node ID to start from
   * @param maxDepth - Maximum depth to fetch (-1 for unlimited)
   * @returns Flat array of all nodes under the parent
   */
  async fetchBranch(
    parentId: string,
    maxDepth: number = -1
  ): Promise<WorkflowyNode[]> {
    const allNodes: WorkflowyNode[] = [];

    const fetchRecursive = async (id: string, depth: number) => {
      if (maxDepth !== -1 && depth >= maxDepth) {
        return;
      }

      const children = await this.listNodes(id);
      allNodes.push(...children);

      await Promise.all(
        children.map((child) => fetchRecursive(child.id, depth + 1))
      );
    };

    await fetchRecursive(parentId, 0);
    return allNodes;
  }
}
