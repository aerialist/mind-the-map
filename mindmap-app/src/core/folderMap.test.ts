import { describe, it, expect } from 'vitest';
import { buildNodesFromFolderTree, type FolderTreeEntry } from './folderMap';

const findNodeByText = (nodes: ReturnType<typeof buildNodesFromFolderTree>['nodes'], text: string) =>
  Object.values(nodes).find(
    (node) => node.content.type === 'text' && node.content.text === text
  );

describe('buildNodesFromFolderTree', () => {
  it('creates linked nodes for folders and files', () => {
    const tree: FolderTreeEntry = {
      name: 'Project',
      path: '/Projects/Project',
      isDir: true,
      children: [
        {
          name: 'src',
          path: '/Projects/Project/src',
          isDir: true,
          children: [
            {
              name: 'index.ts',
              path: '/Projects/Project/src/index.ts',
              isDir: false,
            },
            {
              name: 'specs.mindmap',
              path: '/Projects/Project/src/specs.mindmap',
              isDir: false,
            },
          ],
        },
        {
          name: 'README.md',
          path: '/Projects/Project/README.md',
          isDir: false,
        },
        {
          name: 'cover.png',
          path: '/Projects/Project/cover.png',
          isDir: false,
        },
        {
          name: 'theme.mp3',
          path: '/Projects/Project/theme.mp3',
          isDir: false,
        },
        {
          name: 'demo.mp4',
          path: '/Projects/Project/demo.mp4',
          isDir: false,
        },
        {
          name: 'archive.bin',
          path: '/Projects/Project/archive.bin',
          isDir: false,
        },
      ],
    };

    const { nodes, rootId } = buildNodesFromFolderTree(tree);
    const root = nodes[rootId];

    expect(rootId).toBe('root');
    expect(root.content.type).toBe('text');
    expect(root.content.text).toBe('Project');
    expect(root.link).toBe('/Projects/Project');
    expect(root.childIds).toHaveLength(6);

    const srcNode = findNodeByText(nodes, 'src');
    const readmeNode = findNodeByText(nodes, 'README.md');
    const indexNode = findNodeByText(nodes, 'index.ts');
    const mapNode = findNodeByText(nodes, 'specs.mindmap');
    const imageNode = findNodeByText(nodes, 'cover.png');
    const audioNode = findNodeByText(nodes, 'theme.mp3');
    const videoNode = findNodeByText(nodes, 'demo.mp4');
    const fileNode = findNodeByText(nodes, 'archive.bin');

    expect(srcNode?.parentId).toBe(rootId);
    expect(readmeNode?.parentId).toBe(rootId);
    expect(indexNode?.parentId).toBe(srcNode?.id);
    expect(mapNode?.parentId).toBe(srcNode?.id);

    expect(srcNode?.link).toBe('/Projects/Project/src');
    expect(readmeNode?.link).toBe('/Projects/Project/README.md');
    expect(indexNode?.link).toBe('/Projects/Project/src/index.ts');
    expect(mapNode?.link).toBe('/Projects/Project/src/specs.mindmap');
    expect(imageNode?.link).toBe('/Projects/Project/cover.png');
    expect(audioNode?.link).toBe('/Projects/Project/theme.mp3');
    expect(videoNode?.link).toBe('/Projects/Project/demo.mp4');
    expect(fileNode?.link).toBe('/Projects/Project/archive.bin');

    expect(srcNode?.childIds).toHaveLength(2);
    expect(indexNode?.childIds).toHaveLength(0);
    expect(mapNode?.childIds).toHaveLength(0);

    expect(root.icons?.[0]).toEqual({ type: 'document', value: 'folder' });
    expect(srcNode?.icons?.[0]).toEqual({ type: 'document', value: 'folder' });
    expect(readmeNode?.icons?.[0]).toEqual({ type: 'document', value: 'file-text' });
    expect(indexNode?.icons?.[0]).toEqual({ type: 'document', value: 'code' });
    expect(mapNode?.icons?.[0]).toEqual({ type: 'document', value: 'map' });
    expect(imageNode?.icons?.[0]).toEqual({ type: 'document', value: 'image' });
    expect(audioNode?.icons?.[0]).toEqual({ type: 'document', value: 'audio-lines' });
    expect(videoNode?.icons?.[0]).toEqual({ type: 'document', value: 'video' });
    expect(fileNode?.icons?.[0]).toEqual({ type: 'document', value: 'file' });
  });
});
