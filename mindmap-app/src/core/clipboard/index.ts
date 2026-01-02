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

/**
 * Convert NodeMap subtrees to Miro-compatible format (Excel/Numbers table format)
 * This triggers Miro's special paste dialog for Table/Grid/Sticky notes
 *
 * Format: Each node becomes a row, with columns representing hierarchy depth
 * Example:
 *   Root
 *     Child1
 *       Grandchild1
 *     Child2
 *
 * Becomes a table:
 *   | Level 1 | Level 2      | Level 3      |
 *   | Root    |              |              |
 *   |         | Child1       |              |
 *   |         |              | Grandchild1  |
 *   |         | Child2       |              |
 */
export const nodesToMiroFormat = (
  nodes: NodeMap,
  rootIds: string[]
): { html: string; text: string } => {
  // Collect all nodes with their depths
  const rows: { depth: number; text: string }[] = [];
  let maxDepth = 0;

  const collectNodes = (nodeId: string, depth: number) => {
    const node = nodes[nodeId];
    if (!node) return;

    const text = node.content.type === 'text' ? node.content.text : '';
    rows.push({ depth, text });
    maxDepth = Math.max(maxDepth, depth);

    for (const childId of node.childIds) {
      collectNodes(childId, depth + 1);
    }
  };

  for (const rootId of rootIds) {
    collectNodes(rootId, 0);
  }

  // Generate TSV (tab-separated values) for plain text
  // Each row has empty cells for levels before its depth
  const tsvLines: string[] = [];
  for (const row of rows) {
    const cells: string[] = [];
    for (let i = 0; i <= maxDepth; i++) {
      if (i === row.depth) {
        cells.push(row.text);
      } else {
        cells.push('');
      }
    }
    tsvLines.push(cells.join('\t'));
  }
  const tsvText = tsvLines.join('\n');

  // Generate HTML table with Excel-compatible structure
  // The key is to include proper table structure that Excel/Numbers recognize
  const tableRows: string[] = [];
  for (const row of rows) {
    const cells: string[] = [];
    for (let i = 0; i <= maxDepth; i++) {
      if (i === row.depth) {
        cells.push(`<td>${escapeHtml(row.text)}</td>`);
      } else {
        cells.push('<td></td>');
      }
    }
    tableRows.push(`<tr>${cells.join('')}</tr>`);
  }

  // Excel-style HTML table that Miro recognizes
  const htmlTable = `<meta charset="utf-8"><table>${tableRows.join('')}</table>`;

  return { html: htmlTable, text: tsvText };
};

/**
 * Alternative Miro format: Flat list where each node is a separate item
 * This creates individual sticky notes when pasted as sticky notes in Miro
 */
export const nodesToMiroStickyFormat = (
  nodes: NodeMap,
  rootIds: string[]
): { html: string; text: string } => {
  // Collect all node texts (flattened, depth-first)
  const texts: string[] = [];

  const collectNodes = (nodeId: string) => {
    const node = nodes[nodeId];
    if (!node) return;

    const text = node.content.type === 'text' ? node.content.text : '';
    if (text.trim()) {
      texts.push(text);
    }

    for (const childId of node.childIds) {
      collectNodes(childId);
    }
  };

  for (const rootId of rootIds) {
    collectNodes(rootId);
  }

  // Each text on a new line (for sticky notes)
  const plainText = texts.join('\n');

  // HTML table with one column - each row becomes a sticky note
  const tableRows = texts.map((t) => `<tr><td>${escapeHtml(t)}</td></tr>`);
  const htmlTable = `<meta charset="utf-8"><table>${tableRows.join('')}</table>`;

  return { html: htmlTable, text: plainText };
};
