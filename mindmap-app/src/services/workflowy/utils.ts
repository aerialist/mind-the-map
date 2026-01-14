/**
 * Workflowy utility functions
 */

import { WorkflowyClient } from './client';
import { WorkflowyError } from './types';
import type { WorkflowyNode, WorkflowyTreeNode } from './types';
import { getApiKey } from '../settings';
import type { Node, NodeIcon } from '../../types';

/**
 * Create a WorkflowyClient using the stored API key
 *
 * @returns WorkflowyClient instance
 * @throws WorkflowyError if no API key is configured
 */
export async function createWorkflowyClient(): Promise<WorkflowyClient> {
  const apiKey = await getApiKey('workflowy');

  if (!apiKey) {
    throw new WorkflowyError(
      'Workflowy API key not configured. Please add your API key in Settings > Workflowy.'
    );
  }

  return new WorkflowyClient(apiKey);
}

/**
 * Test the Workflowy connection using the stored API key
 *
 * @returns true if connection is successful
 * @throws WorkflowyError with details if connection fails
 */
export async function testWorkflowyConnection(): Promise<boolean> {
  const client = await createWorkflowyClient();

  // Try to get targets as a simple connectivity test
  await client.getTargets();
  return true;
}

// ============================================================================
// Node Conversion Utilities
// ============================================================================

/**
 * Convert a Workflowy node to a Mind-the-Map node
 *
 * @param wfNode - Workflowy node
 * @param parentId - Parent node ID in Mind-the-Map (null for root)
 * @param childIds - Array of child node IDs (empty initially, populated later)
 * @returns Mind-the-Map node
 */
export function workflowyNodeToMtmNode(
  wfNode: WorkflowyNode,
  parentId: string | null,
  childIds: string[] = []
): Node {
  // Convert completion status to icon
  const icons: NodeIcon[] = [];
  if (wfNode.completedAt !== null) {
    icons.push({ type: 'status', value: 'done' });
  }

  return {
    id: wfNode.id,
    parentId,
    childIds,
    content: {
      type: 'text',
      text: wfNode.name,
    },
    position: {
      x: 0,
      y: 0,
      source: 'auto',
    },
    isCollapsed: false,
    icons: icons.length > 0 ? icons : undefined,
    workflowySync: {
      workflowyId: wfNode.id,
      lastSyncedAt: Date.now(),
      lastModifiedAt: wfNode.modifiedAt,
    },
    // Note: wfNode.note is not currently mapped (MTM doesn't have notes)
    // Note: wfNode.data.layoutMode is not currently mapped
  };
}

/**
 * Convert a Workflowy tree to Mind-the-Map node map
 *
 * @param tree - Workflowy tree (single root node with children)
 * @returns Object with rootId and nodes map
 */
export function workflowyTreeToMtmNodes(
  tree: WorkflowyTreeNode
): { rootId: string; nodes: Record<string, Node> } {
  const nodes: Record<string, Node> = {};

  const processNode = (
    wfNode: WorkflowyTreeNode,
    parentId: string | null
  ): void => {
    // Get child IDs (already sorted by priority in buildTree)
    const childIds = wfNode.children.map((child) => child.id);

    // Convert and add to nodes map
    nodes[wfNode.id] = workflowyNodeToMtmNode(wfNode, parentId, childIds);

    // Process children recursively
    for (const child of wfNode.children) {
      processNode(child, wfNode.id);
    }
  };

  processNode(tree, null);

  return {
    rootId: tree.id,
    nodes,
  };
}

/**
 * Convert Mind-the-Map nodes back to Workflowy format for sync
 *
 * @param mtmNode - Mind-the-Map node
 * @returns Partial Workflowy node data for API updates
 */
export function mtmNodeToWorkflowyUpdate(
  mtmNode: Node
): { name: string; completed: boolean } {
  const text =
    mtmNode.content.type === 'text' ? mtmNode.content.text : '[Image]';

  // Check for completion status icon
  const isCompleted =
    mtmNode.icons?.some(
      (icon) => icon.type === 'status' && icon.value === 'done'
    ) ?? false;

  return {
    name: text,
    completed: isCompleted,
  };
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Strip markdown formatting from Workflowy node text
 *
 * Workflowy supports: **bold**, *italic*, ~~strikethrough~~, `code`, [links](url)
 *
 * @param text - Text with potential markdown
 * @returns Plain text
 */
export function stripWorkflowyMarkdown(text: string): string {
  return text
    // Remove bold
    .replace(/\*\*(.+?)\*\*/g, '$1')
    // Remove italic
    .replace(/\*(.+?)\*/g, '$1')
    // Remove strikethrough
    .replace(/~~(.+?)~~/g, '$1')
    // Remove inline code
    .replace(/`(.+?)`/g, '$1')
    // Convert links to just the text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');
}

/**
 * Parse Workflowy date format
 *
 * Workflowy uses [YYYY-MM-DD] or [YYYY-MM-DD HH:MM] format
 *
 * @param text - Text that may contain dates
 * @returns Array of parsed dates found in text
 */
export function parseWorkflowyDates(text: string): Date[] {
  const dateRegex = /\[(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\]/g;
  const dates: Date[] = [];

  let match;
  while ((match = dateRegex.exec(text)) !== null) {
    const dateStr = match[1];
    const timeStr = match[2] || '00:00';
    const date = new Date(`${dateStr}T${timeStr}:00`);
    if (!isNaN(date.getTime())) {
      dates.push(date);
    }
  }

  return dates;
}

// ============================================================================
// Sync Functions
// ============================================================================

/**
 * Result of a sync operation
 */
export interface SyncResult {
  updated: number;
  created: number;
  deleted: number;
  errors: Array<{ nodeId: string; error: string }>;
}

/**
 * Push local changes to Workflowy
 *
 * Compares local nodes with their Workflowy sync metadata and pushes changes.
 *
 * @param nodes - Local nodes map
 * @param rootId - Root node ID
 * @returns Sync result with counts of operations performed
 */
export async function pushToWorkflowy(
  nodes: Record<string, Node>,
  rootId: string
): Promise<SyncResult & { updatedNodes: Record<string, Node> }> {
  const client = await createWorkflowyClient();
  const result: SyncResult & { updatedNodes: Record<string, Node> } = {
    updated: 0,
    created: 0,
    deleted: 0,
    errors: [],
    updatedNodes: {},
  };

  // Get the root node's Workflowy ID to fetch remote state for deletion detection
  const rootNode = nodes[rootId];
  const rootWfId = rootNode?.workflowySync?.workflowyId;

  // Fetch current Workflowy tree to detect deletions
  let remoteNodeIds: Set<string> | null = null;
  if (rootWfId) {
    try {
      const remoteTree = await client.getSubtree(rootWfId);
      if (remoteTree) {
        const { nodes: remoteNodes } = workflowyTreeToMtmNodes(remoteTree);
        remoteNodeIds = new Set(Object.keys(remoteNodes));
      }
    } catch {
      // If we can't fetch remote tree, skip deletion detection
    }
  }

  // Deep copy nodes so we can modify them (Zustand state is frozen)
  const mutableNodes: Record<string, Node> = {};
  for (const [id, node] of Object.entries(nodes)) {
    mutableNodes[id] = {
      ...node,
      childIds: [...node.childIds],
      content: { ...node.content },
      position: { ...node.position },
      icons: node.icons ? [...node.icons] : undefined,
      workflowySync: node.workflowySync ? { ...node.workflowySync } : undefined,
    };
  }

  // Helper to get all nodes in tree order (depth-first)
  const getAllNodesInOrder = (nodeId: string): Node[] => {
    const node = mutableNodes[nodeId];
    if (!node) return [];

    const nodeList = [node];
    for (const childId of node.childIds) {
      nodeList.push(...getAllNodesInOrder(childId));
    }
    return nodeList;
  };

  const allNodes = getAllNodesInOrder(rootId);

  // Process nodes in tree order
  for (const node of allNodes) {
    if (!node.workflowySync) {
      // This is a new node created locally - create it in Workflowy
      try {
        const parentSync = node.parentId ? mutableNodes[node.parentId]?.workflowySync : null;

        if (!parentSync && node.parentId) {
          // Parent hasn't been synced yet - this shouldn't happen in tree order
          result.errors.push({
            nodeId: node.id,
            error: 'Parent node has not been synced to Workflowy yet.',
          });
          continue;
        }

        const parentWfId = parentSync?.workflowyId || rootId;
        const text = node.content.type === 'text' ? node.content.text : '[Image]';

        // Determine position based on siblings
        // Workflowy API only supports 'top' or 'bottom' - no exact positioning
        const parentNode = node.parentId ? mutableNodes[node.parentId] : null;
        let position: 'top' | 'bottom' = 'bottom'; // Default to bottom (most common: add as last child)

        if (parentNode) {
          const siblingIndex = parentNode.childIds.indexOf(node.id);
          // If this is the first child (index 0), use 'top'
          // Otherwise use 'bottom' (will be added after all existing children)
          if (siblingIndex === 0) {
            position = 'top';
          }
        }

        // Create the node in Workflowy at the determined position
        const newNodeId = await client.createNode(parentWfId, text, { position });

        // Set completion status if needed
        const isDone = node.icons?.some(icon => icon.type === 'status' && icon.value === 'done');
        if (isDone) {
          await client.completeNode(newNodeId);
        }

        // Fetch the newly created node to get its metadata
        const createdNode = await client.getNode(newNodeId);

        // Update sync metadata
        node.workflowySync = {
          workflowyId: newNodeId,
          lastSyncedAt: Date.now(),
          lastModifiedAt: createdNode.modifiedAt,
        };

        result.created++;
      } catch (error) {
        result.errors.push({
          nodeId: node.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      // Update existing node - only push if there are local changes
      try {
        const wfId = node.workflowySync.workflowyId;
        const text = node.content.type === 'text' ? node.content.text : '[Image]';
        const isDone = node.icons?.some(icon => icon.type === 'status' && icon.value === 'done') ?? false;

        // Check if local content differs from what we last synced
        // We track this by comparing current local state vs what Workflowy had at last sync
        // For simplicity, we'll fetch the current Workflowy state and compare
        const wfNode = await client.getNode(wfId);

        const textNeedsUpdate = wfNode.name !== text;
        const wasDone = wfNode.completedAt !== null;
        const completionNeedsUpdate = isDone !== wasDone;

        // If nothing needs to change locally, skip this node entirely
        if (!textNeedsUpdate && !completionNeedsUpdate) {
          // Just sync metadata - no actual update needed
          node.workflowySync.lastModifiedAt = wfNode.modifiedAt;
          node.workflowySync.lastSyncedAt = Date.now();
          // Don't count as "updated" since nothing actually changed
          continue;
        }

        // There are local changes - check for conflicts with remote
        if (wfNode.modifiedAt > node.workflowySync.lastModifiedAt) {
          // Remote was modified since our last sync - potential conflict
          // Check if remote content is different from what we have
          const remoteHasChanges = wfNode.name !== text || wasDone !== isDone;

          if (remoteHasChanges) {
            // True conflict - both sides have different content
            result.errors.push({
              nodeId: node.id,
              error: 'Conflict: Both local and remote have changes. Pull changes first.',
            });
            continue;
          }
          // Remote timestamp is newer but content matches - safe to proceed
        }

        // Apply local changes to Workflowy
        if (textNeedsUpdate) {
          await client.updateNode(wfId, { name: text });
        }

        if (isDone && !wasDone) {
          await client.completeNode(wfId);
        } else if (!isDone && wasDone) {
          await client.uncompleteNode(wfId);
        }

        // Fetch updated node to get new modifiedAt timestamp
        const updatedNode = await client.getNode(wfId);
        node.workflowySync.lastModifiedAt = updatedNode.modifiedAt;
        node.workflowySync.lastSyncedAt = Date.now();

        result.updated++;
      } catch (error) {
        result.errors.push({
          nodeId: node.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Handle deletions - nodes that exist in Workflowy but not locally
  if (remoteNodeIds) {
    for (const remoteNodeId of remoteNodeIds) {
      // Skip if node still exists locally
      if (mutableNodes[remoteNodeId]) continue;

      // This node was deleted locally - delete it from Workflowy
      try {
        await client.deleteNode(remoteNodeId);
        result.deleted++;
      } catch (error) {
        result.errors.push({
          nodeId: remoteNodeId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Return the mutable nodes with updated sync metadata
  result.updatedNodes = mutableNodes;
  return result;
}

/**
 * Pull changes from Workflowy and merge with local nodes
 *
 * @param targetBulletId - Workflowy node ID to sync with
 * @param localNodes - Current local nodes
 * @returns Updated nodes map with Workflowy changes merged
 */
export async function pullFromWorkflowy(
  targetBulletId: string,
  localNodes: Record<string, Node>
): Promise<{ nodes: Record<string, Node>; conflicts: string[] }> {
  const client = await createWorkflowyClient();
  const tree = await client.getSubtree(targetBulletId);

  if (!tree) {
    throw new WorkflowyError(`Could not find Workflowy node with ID: ${targetBulletId}`);
  }

  const conflicts: string[] = [];

  // Convert Workflowy tree to flat map
  const { nodes: remoteNodes } = workflowyTreeToMtmNodes(tree);

  // Start fresh with remote structure but preserve local UI state
  const mergedNodes: Record<string, Node> = {};

  // First pass: Add all remote nodes
  for (const [nodeId, remoteNode] of Object.entries(remoteNodes)) {
    const localNode = localNodes[nodeId];

    if (!localNode) {
      // New node from Workflowy - add it as-is
      mergedNodes[nodeId] = remoteNode;
    } else if (localNode.workflowySync) {
      // Existing node - check for conflicts
      const remoteModified = remoteNode.workflowySync!.lastModifiedAt;
      const localModified = localNode.workflowySync.lastModifiedAt;

      if (remoteModified > localModified) {
        // Remote is newer - check for local changes
        const localChanged = localNode.workflowySync.lastSyncedAt < localModified;

        if (localChanged) {
          conflicts.push(`Node "${localNode.content.type === 'text' ? localNode.content.text : nodeId}" has both local and remote changes`);
          // Keep local version but flag conflict
          mergedNodes[nodeId] = localNode;
          continue;
        }

        // No local changes - accept remote version but preserve local UI state
        mergedNodes[nodeId] = {
          ...remoteNode,
          position: localNode.position, // Keep local position
          isCollapsed: localNode.isCollapsed, // Keep local collapsed state
        };
      } else {
        // Local version is same or newer - keep it but update structure from remote
        mergedNodes[nodeId] = {
          ...localNode,
          parentId: remoteNode.parentId, // Update parent from remote
          childIds: remoteNode.childIds, // Update children from remote
        };
      }
    } else {
      // Node exists locally but has no sync metadata - shouldn't happen
      mergedNodes[nodeId] = remoteNode;
    }
  }

  // Second pass: Handle deletions (nodes in local but not in remote)
  for (const [nodeId, localNode] of Object.entries(localNodes)) {
    if (localNode.workflowySync && !remoteNodes[nodeId]) {
      // Node was deleted in Workflowy - don't include in merged nodes
      // (it's already not in mergedNodes since we only added remoteNodes)
    }
  }

  return { nodes: mergedNodes, conflicts };
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Result of importing from Workflowy
 */
export interface WorkflowyImportResult {
  rootId: string;
  nodes: Record<string, Node>;
  nodeCount: number;
  rootText: string;
}

/**
 * Import a Workflowy subtree by node ID
 *
 * @param targetBulletId - The Workflowy node ID to import
 * @returns Import result with nodes ready for loadDocument
 * @throws WorkflowyError if import fails
 */
export async function importFromWorkflowy(
  targetBulletId: string
): Promise<WorkflowyImportResult> {
  if (!targetBulletId) {
    throw new WorkflowyError('No target bullet ID specified');
  }

  const client = await createWorkflowyClient();

  // Fetch the subtree
  const tree = await client.getSubtree(targetBulletId);

  if (!tree) {
    throw new WorkflowyError(
      `Could not find Workflowy node with ID: ${targetBulletId}`
    );
  }

  // Convert to MTM format
  const { rootId, nodes } = workflowyTreeToMtmNodes(tree);

  return {
    rootId,
    nodes,
    nodeCount: Object.keys(nodes).length,
    rootText: tree.name,
  };
}
