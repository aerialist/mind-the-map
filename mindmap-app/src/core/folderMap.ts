import type { Node, NodeMap, DocumentIcon } from '../types';

export type FolderTreeEntry = {
  name: string;
  path: string;
  isDir: boolean;
  children?: FolderTreeEntry[];
};

const createNodeId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `node-${crypto.randomUUID()}`;
  }
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const buildNodesFromFolderTree = (
  entry: FolderTreeEntry
): { nodes: NodeMap; rootId: string } => {
  const nodes: NodeMap = {};
  const rootId = 'root';

  const documentExtensions = new Set([
    'txt',
    'md',
    'markdown',
    'rtf',
    'doc',
    'docx',
    'odt',
    'pdf',
    'csv',
    'tsv',
  ]);

  const imageExtensions = new Set([
    'png',
    'jpg',
    'jpeg',
    'gif',
    'bmp',
    'svg',
    'webp',
    'tif',
    'tiff',
    'heic',
    'heif',
    'ico',
  ]);

  const audioExtensions = new Set([
    'wav',
    'mp3',
    'm4a',
    'aac',
    'ogg',
    'flac',
    'opus',
    'aiff',
    'alac',
    'wma',
  ]);

  const videoExtensions = new Set([
    'mp4',
    'mov',
    'mkv',
    'avi',
    'wmv',
    'webm',
    'flv',
    'mpeg',
    'mpg',
    'm4v',
  ]);

  const codeExtensions = new Set([
    'js',
    'jsx',
    'ts',
    'tsx',
    'py',
    'rb',
    'go',
    'rs',
    'java',
    'c',
    'cc',
    'cpp',
    'h',
    'hpp',
    'cs',
    'php',
    'swift',
    'kt',
    'kts',
    'scala',
    'sh',
    'bash',
    'zsh',
    'fish',
    'ps1',
    'lua',
    'sql',
    'html',
    'css',
    'scss',
    'json',
    'yaml',
    'yml',
    'toml',
    'ini',
    'xml',
  ]);

  const getDocumentIcon = (item: FolderTreeEntry): DocumentIcon => {
    if (item.isDir) return 'folder';

    const extension = item.name.split('.').pop()?.toLowerCase();
    if (!extension || extension === item.name.toLowerCase()) {
      return 'file';
    }

    if (extension === 'mindmap') return 'map';
    if (imageExtensions.has(extension)) return 'image';
    if (audioExtensions.has(extension)) return 'audio-lines';
    if (videoExtensions.has(extension)) return 'video';
    if (codeExtensions.has(extension)) return 'code';
    if (documentExtensions.has(extension)) return 'file-text';

    return 'file';
  };

  const createNode = (
    item: FolderTreeEntry,
    parentId: string | null,
    forcedId?: string
  ): string => {
    const id = forcedId ?? createNodeId();
    const node: Node = {
      id,
      parentId,
      childIds: [],
      content: { type: 'text', text: item.name },
      position: { x: 0, y: 0, source: 'auto' },
      isCollapsed: false,
      link: item.path,
      icons: [{ type: 'document', value: getDocumentIcon(item) }],
    };

    nodes[id] = node;

    const children = item.children ?? [];
    for (const child of children) {
      const childId = createNode(child, id);
      node.childIds.push(childId);
    }

    return id;
  };

  createNode(entry, null, rootId);

  return { nodes, rootId };
};
