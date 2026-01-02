// Clipboard utilities for copy/paste with external apps (Workflowy, etc.)

import type { Node, NodeMap } from '../../types';

// Generate unique ID
const generateId = (): string => {
  return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Parsed node structure from external clipboard
export interface ParsedNode {
  text: string;
  children: ParsedNode[];
}

/**
 * Parse HTML clipboard content (nested ul/li structure) into hierarchical nodes
 * Compatible with Workflowy, and other outline tools that use HTML lists
 */
export const parseHtmlToNodes = (html: string): ParsedNode[] => {
  // Create a DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find the root ul element
  const rootUl = doc.querySelector('ul');
  if (!rootUl) {
    return [];
  }

  // Recursively parse li elements
  const parseLiElements = (ul: Element): ParsedNode[] => {
    const result: ParsedNode[] = [];

    // Get direct li children only
    const liElements = Array.from(ul.children).filter(
      (child) => child.tagName.toLowerCase() === 'li'
    );

    for (const li of liElements) {
      // Extract text content from this li (not including nested ul)
      let text = '';

      // Try to find text in common structures:
      // 1. Workflowy uses: <li><div class="name"><span class="innerContentContainer">text</span></div></li>
      // 2. Generic: just text content before any nested ul

      const innerContentSpan = li.querySelector('.innerContentContainer');
      if (innerContentSpan) {
        text = innerContentSpan.textContent?.trim() || '';
      } else {
        // Get text content excluding nested ul
        const nestedUl = li.querySelector('ul');
        if (nestedUl) {
          // Clone li and remove nested ul to get just the text
          const liClone = li.cloneNode(true) as Element;
          const nestedUlInClone = liClone.querySelector('ul');
          if (nestedUlInClone) {
            nestedUlInClone.remove();
          }
          text = liClone.textContent?.trim() || '';
        } else {
          text = li.textContent?.trim() || '';
        }
      }

      // Find nested ul for children
      const nestedUl = li.querySelector('ul');
      const children = nestedUl ? parseLiElements(nestedUl) : [];

      if (text || children.length > 0) {
        result.push({ text, children });
      }
    }

    return result;
  };

  return parseLiElements(rootUl);
};

/**
 * Convert ParsedNodes to NodeMap with proper parent-child relationships
 */
export const parsedNodesToNodeMap = (
  parsedNodes: ParsedNode[],
  targetParentId: string
): { nodes: NodeMap; rootIds: string[] } => {
  const nodes: NodeMap = {};
  const rootIds: string[] = [];

  const createNodesRecursively = (
    parsed: ParsedNode[],
    parentId: string
  ): string[] => {
    const childIds: string[] = [];

    for (const p of parsed) {
      const nodeId = generateId();
      childIds.push(nodeId);

      // Create children first to get their IDs
      const grandchildIds = createNodesRecursively(p.children, nodeId);

      const node: Node = {
        id: nodeId,
        parentId,
        childIds: grandchildIds,
        content: { type: 'text', text: p.text || 'Untitled' },
        position: { x: 0, y: 0, source: 'auto' },
        isCollapsed: false,
      };

      nodes[nodeId] = node;
    }

    return childIds;
  };

  // Create nodes with target parent
  const createdIds = createNodesRecursively(parsedNodes, targetParentId);
  rootIds.push(...createdIds);

  return { nodes, rootIds };
};

/**
 * Convert NodeMap subtrees to HTML format for clipboard
 * Generates nested ul/li structure compatible with Workflowy
 */
export const nodesToHtml = (nodes: NodeMap, rootIds: string[]): string => {
  const renderNode = (nodeId: string): string => {
    const node = nodes[nodeId];
    if (!node) return '';

    const text = node.content.type === 'text' ? node.content.text : '';
    const escapedText = escapeHtml(text);

    if (node.childIds.length === 0) {
      return `<li>${escapedText}</li>`;
    }

    const childrenHtml = node.childIds.map(renderNode).join('');
    return `<li>${escapedText}<ul>${childrenHtml}</ul></li>`;
  };

  const itemsHtml = rootIds.map(renderNode).join('');
  return `<ul>${itemsHtml}</ul>`;
};

/**
 * Convert NodeMap subtrees to plain text format
 * Uses indentation to represent hierarchy
 */
export const nodesToPlainText = (
  nodes: NodeMap,
  rootIds: string[],
  indentChar: string = '\t'
): string => {
  const lines: string[] = [];

  const renderNode = (nodeId: string, depth: number) => {
    const node = nodes[nodeId];
    if (!node) return;

    const text = node.content.type === 'text' ? node.content.text : '';
    const indent = indentChar.repeat(depth);
    lines.push(`${indent}${text}`);

    for (const childId of node.childIds) {
      renderNode(childId, depth + 1);
    }
  };

  for (const rootId of rootIds) {
    renderNode(rootId, 0);
  }

  return lines.join('\n');
};

/**
 * Parse indented plain text to hierarchical nodes
 * Each line's indentation (tabs or 2/4 spaces) determines its level
 */
export const parseIndentedTextToNodes = (text: string): ParsedNode[] => {
  const lines = text.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];

  // Detect indentation style (tabs or spaces)
  const detectIndentUnit = (): string => {
    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match) {
        const indent = match[1];
        if (indent.includes('\t')) return '\t';
        // Check for 2-space or 4-space indentation
        if (indent.length >= 4) return '    ';
        if (indent.length >= 2) return '  ';
      }
    }
    return '\t'; // Default to tabs
  };

  const indentUnit = detectIndentUnit();

  // Calculate indent level for each line
  const getIndentLevel = (line: string): number => {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    const indent = match[1];
    if (indentUnit === '\t') {
      return (indent.match(/\t/g) || []).length;
    }
    return Math.floor(indent.length / indentUnit.length);
  };

  // Build tree structure
  const result: ParsedNode[] = [];
  const stack: { node: ParsedNode; level: number }[] = [];

  for (const line of lines) {
    const level = getIndentLevel(line);
    const text = line.trim();

    const newNode: ParsedNode = { text, children: [] };

    // Pop stack until we find the parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level node
      result.push(newNode);
    } else {
      // Add as child of the last item in stack
      stack[stack.length - 1].node.children.push(newNode);
    }

    stack.push({ node: newNode, level });
  }

  return result;
};

// Helper to escape HTML special characters
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};
