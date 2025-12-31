// Navigation utilities for keyboard movement between nodes

import type { NodeMap } from '../../types';

/**
 * Get a flat list of visible node IDs in display order
 * This respects collapsed state - collapsed children are not included
 */
export const getVisibleNodeIds = (
  nodes: NodeMap,
  rootId: string
): string[] => {
  const result: string[] = [];

  const traverse = (nodeId: string) => {
    const node = nodes[nodeId];
    if (!node) return;

    result.push(nodeId);

    // Only traverse children if not collapsed
    if (!node.isCollapsed) {
      for (const childId of node.childIds) {
        traverse(childId);
      }
    }
  };

  traverse(rootId);
  return result;
};

/**
 * Get the next node ID in the visible list
 */
export const getNextNodeId = (
  nodes: NodeMap,
  rootId: string,
  currentNodeId: string
): string | null => {
  const visibleIds = getVisibleNodeIds(nodes, rootId);
  const currentIndex = visibleIds.indexOf(currentNodeId);

  if (currentIndex === -1 || currentIndex === visibleIds.length - 1) {
    return null;
  }

  return visibleIds[currentIndex + 1];
};

/**
 * Get the previous node ID in the visible list
 */
export const getPreviousNodeId = (
  nodes: NodeMap,
  rootId: string,
  currentNodeId: string
): string | null => {
  const visibleIds = getVisibleNodeIds(nodes, rootId);
  const currentIndex = visibleIds.indexOf(currentNodeId);

  if (currentIndex <= 0) {
    return null;
  }

  return visibleIds[currentIndex - 1];
};

/**
 * Get the parent node ID
 */
export const getParentNodeId = (
  nodes: NodeMap,
  currentNodeId: string
): string | null => {
  const node = nodes[currentNodeId];
  return node?.parentId ?? null;
};

/**
 * Get the first child node ID (if expanded and has children)
 */
export const getFirstChildNodeId = (
  nodes: NodeMap,
  currentNodeId: string
): string | null => {
  const node = nodes[currentNodeId];
  if (!node || node.isCollapsed || node.childIds.length === 0) {
    return null;
  }
  return node.childIds[0];
};
