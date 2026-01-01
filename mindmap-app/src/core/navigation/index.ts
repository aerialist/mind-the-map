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

/**
 * Get the next sibling node ID
 */
export const getNextSiblingNodeId = (
  nodes: NodeMap,
  currentNodeId: string
): string | null => {
  const node = nodes[currentNodeId];
  if (!node || !node.parentId) {
    return null;
  }

  const parent = nodes[node.parentId];
  if (!parent) {
    return null;
  }

  const currentIndex = parent.childIds.indexOf(currentNodeId);
  if (currentIndex === -1 || currentIndex === parent.childIds.length - 1) {
    return null;
  }

  return parent.childIds[currentIndex + 1];
};

/**
 * Get the previous sibling node ID
 */
export const getPreviousSiblingNodeId = (
  nodes: NodeMap,
  currentNodeId: string
): string | null => {
  const node = nodes[currentNodeId];
  if (!node || !node.parentId) {
    return null;
  }

  const parent = nodes[node.parentId];
  if (!parent) {
    return null;
  }

  const currentIndex = parent.childIds.indexOf(currentNodeId);
  if (currentIndex <= 0) {
    return null;
  }

  return parent.childIds[currentIndex - 1];
};

/**
 * Get the next node for down arrow navigation
 * Priority: next sibling > first child (if expanded) > parent's next sibling (recursively)
 */
export const getDownNodeId = (
  nodes: NodeMap,
  currentNodeId: string
): string | null => {
  // First try next sibling
  const nextSibling = getNextSiblingNodeId(nodes, currentNodeId);
  if (nextSibling) {
    return nextSibling;
  }

  // If no next sibling, try first child (if expanded)
  const firstChild = getFirstChildNodeId(nodes, currentNodeId);
  if (firstChild) {
    return firstChild;
  }

  // If no next sibling and no children, try parent's next sibling (recursively)
  let ancestorId = getParentNodeId(nodes, currentNodeId);
  while (ancestorId) {
    const ancestorNextSibling = getNextSiblingNodeId(nodes, ancestorId);
    if (ancestorNextSibling) {
      return ancestorNextSibling;
    }
    ancestorId = getParentNodeId(nodes, ancestorId);
  }

  return null;
};

/**
 * Get the previous node for up arrow navigation
 * Priority: previous sibling > parent (if no previous sibling)
 */
export const getUpNodeId = (
  nodes: NodeMap,
  currentNodeId: string
): string | null => {
  // First try previous sibling
  const prevSibling = getPreviousSiblingNodeId(nodes, currentNodeId);
  if (prevSibling) {
    return prevSibling;
  }

  // If no previous sibling, go to parent
  const parent = getParentNodeId(nodes, currentNodeId);
  if (parent) {
    return parent;
  }

  return null;
};
