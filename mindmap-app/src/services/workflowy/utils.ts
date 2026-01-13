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
