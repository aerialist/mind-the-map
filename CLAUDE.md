# CLAUDE.md - AI Development Context

This document provides context for AI assistants working on the Mind the Map codebase.

## Project Overview

**Mind the Map** is a keyboard-centric mind mapping application with dual view modes (mind map canvas and outline list). Built with Tauri 2.0 for native desktop performance.

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Tauri | 2.x |
| Frontend | React + TypeScript | 19.x / 5.8 |
| State | Zustand + Immer | 5.x / 11.x |
| Rendering | PixiJS | 8.x |
| Styling | Tailwind CSS | 3.x |
| Build | Vite | 7.x |
| Icons | Lucide React | 0.562.x |

### Key Design Principles

1. **Keyboard-first**: Every action has a keyboard shortcut
2. **Performance**: 60fps rendering, instant response
3. **Dual modes**: Mind map (2D canvas) and Outline (hierarchical list)
4. **Local-first**: No cloud, files saved as JSON (.mindmap extension)

---

## Project Structure

```
mind-the-map/
├── README.md                    # Developer guide
├── CLAUDE.md                    # This file (AI context)
├── docs/index.html              # User manual (web page)
│
└── mindmap-app/
    ├── src/
    │   ├── main.tsx             # Entry point
    │   ├── App.tsx              # Root component + global keyboard handlers
    │   │
    │   ├── types/               # TypeScript types
    │   │   └── index.ts         # Node, Document, Position, NodeIcon
    │   │
    │   ├── store/               # Zustand state management
    │   │   ├── documentStore.ts # Main store (nodes, selection, history)
    │   │   └── selectors.ts     # Memoized selectors
    │   │
    │   ├── core/                # Pure logic (no React)
    │   │   ├── operations/      # Node CRUD operations
    │   │   ├── layout/          # Tree layout algorithm
    │   │   ├── navigation/      # Keyboard navigation logic
    │   │   ├── clipboard/       # Copy/paste with external app support
    │   │   └── serialization/   # JSON file format
    │   │
    │   ├── components/
    │   │   ├── MindMap/         # PixiJS canvas rendering
    │   │   │   ├── MindMapCanvas.tsx
    │   │   │   ├── NodeRenderer.ts
    │   │   │   └── EdgeRenderer.ts
    │   │   ├── Outline/         # List view components
    │   │   ├── Help/            # Help dialog (cheat sheet)
    │   │   ├── IconPicker/      # Icons panel (right sidebar)
    │   │   ├── LinkDialog/      # Node link editor
    │   │   └── Search/          # Search & Filter panel (right sidebar)
    │   │
    │   ├── hooks/               # Custom React hooks
    │   │   ├── useAutoSave.ts
    │   │   ├── useKeyboardNavigation.ts
    │   │   └── useFileOperations.ts
    │   │
    │   └── services/tauri/      # Tauri API wrappers
    │       ├── fileSystem.ts
    │       └── dialogs.ts
    │
    └── src-tauri/               # Rust backend
        └── src/commands/        # File I/O commands
```

---

## Core Data Model

### Node Structure

```typescript
interface Node {
  id: string;
  parentId: string | null;
  childIds: string[];
  text: string;
  icons: NodeIcon[];           // Multiple icons allowed (one per category)
  position: Position;
  isCollapsed: boolean;
}

interface Position {
  x: number;
  y: number;
  source: 'auto' | 'manual';   // Respect manual positions in layout
}

interface NodeIcon {
  type: 'priority' | 'status' | 'flag' | 'mood' | 'time' | 'people' | 'communication' | 'document' | 'symbol' | 'notice';
  value: string | number;      // e.g., 1, 'done', 'red', 'positive'
}
```

### Document State (Zustand Store)

```typescript
// Key state in documentStore.ts
interface DocumentState {
  // Data
  nodes: Record<string, Node>;
  rootId: string;

  // Selection
  selectedNodeIds: string[];   // Multi-selection support
  editingNodeId: string | null;

  // View
  viewMode: 'mindmap' | 'outline';
  viewport: { x: number; y: number; zoom: number };

  // File
  filePath: string | null;
  isDirty: boolean;

  // UI
  isSearchOpen: boolean;
  isHelpOpen: boolean;
  isIconPickerOpen: boolean;
  isLinkDialogOpen: boolean;

  // Search & Filter
  searchQuery: string;
  searchResults: SearchResult[];
  activeIconFilters: IconFilter[];  // Icon filters applied to document view
  availableIcons: IconFilter[];     // Icons that exist in the document

  // History
  history: HistoryEntry[];
  historyIndex: number;
}
```

---

## Keyboard Shortcuts Reference

### Node Operations
| Key | Action | Notes |
|-----|--------|-------|
| Tab | Create child node | Works in edit mode too |
| Enter | Create sibling below | Works in edit mode too |
| Shift+Enter | Create sibling above | Works in edit mode too |
| Cmd+] (Ctrl+]) | Indent node | Move to child of node above |
| Cmd+[ (Ctrl+[) | Outdent node | Move to sibling of parent |
| E / F2 | Start editing | Double-click also works |
| Escape | Save and stop editing | |
| Ctrl+Escape | Cancel editing | Discards changes |
| Delete/Backspace | Delete node | Root protected |
| I | Toggle icons panel | |

### Navigation
| Key | Action |
|-----|--------|
| ↑ ↓ | Move between siblings |
| ← | Go to parent / collapse |
| → | Go to first child / expand |
| Space | Toggle collapse |
| Shift+Alt+Space | Smart collapse all (3-state) |
| Ctrl+F | Toggle Search & Filter panel |
| Ctrl+K | Open link dialog |

### Clipboard
| Key | Action |
|-----|--------|
| Ctrl+C | Copy nodes with descendants |
| Ctrl+X | Cut nodes |
| Ctrl+V | Paste as children |
| Ctrl+Shift+M | Copy for Miro (table format) |

### Multi-Selection
| Action | Result |
|--------|--------|
| Ctrl+Click | Toggle node in selection |
| Shift+Click | Range select |

### File & View
| Key | Action |
|-----|--------|
| Ctrl+N/O/S | New/Open/Save |
| Ctrl+Shift+S | Save As |
| Ctrl+1 | Mind map view |
| Ctrl+2 | Outline view |
| Ctrl+0 | Fit tree to view (mind map) |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| ? / Ctrl+/ | Open help dialog |

---

## Implementation Notes

### IME Support (Japanese/Chinese Input)
- `compositionstart`/`compositionend` events track IME state
- Enter during composition confirms character, not node operation
- Check `isComposing` before handling Enter key

### Smart Collapse (Shift+Alt+Space)
Cycles through 3 states:
1. **Collapsed**: All children hidden
2. **Expanded except completed**: Shows all except nodes with Done status icon (✓)
3. **Fully expanded**: Everything visible

### External Clipboard Support
When pasting from external apps:
1. Check for HTML format (ul/li lists from Workflowy, etc.)
2. Parse indented plain text (tabs/spaces → hierarchy)
3. Fall back to flat text (each line = sibling node)

### Miro Export (Ctrl+Shift+M)
Copies as TSV + HTML table format:
- Column 1: Node text
- Column 2: Parent index (for hierarchy)
- Miro's "Table" paste option interprets this correctly

### PixiJS Rendering (Mind Map Mode)
- Uses PixiJS 8 Application class
- Nodes are PIXI.Container with text + background
- Edges use PIXI.Graphics with bezier curves
- Viewport controls:
  - Right-click + drag: Pan
  - Mouse wheel: Zoom
  - Ctrl + wheel: Vertical pan
  - Shift + wheel: Horizontal pan

### Tree Layout Algorithm
- Located in `core/layout/`
- Respects `position.source === 'manual'` nodes
- Calculates positions for `source === 'auto'` nodes only
- Avoids overlaps between all nodes

### Search & Filter Panel (Ctrl+F)
The Search & Filter panel is a right sidebar with two distinct sections:

**Search (text-based)**:
- Text search through all node content
- Results listed in sidebar for quick navigation
- Click result to select and scroll to node
- Panel stays open while working

**Filter (icon-based)**:
- Filters the document view directly (hides non-matching nodes)
- Shows all icons present in the document, grouped by category
- Multiple filters can be active simultaneously (OR logic)
- Parent nodes remain visible to maintain tree context
- Works in both Mind Map and Outline views
- Uses `computeVisibleNodeIds()` helper to calculate visible set

Key implementation:
- `activeIconFilters`: Currently selected icon filters
- `availableIcons`: All icons found in the document (refreshed on panel open)
- `computeVisibleNodeIds()`: Returns Set of node IDs that should be visible
- `VisibleNodesContext`: React context to pass visibility down the OutlineNode tree

---

## Common Development Tasks

### Adding a New Keyboard Shortcut

1. Add handler in `App.tsx` (global) or component (local)
2. Update `HelpDialog.tsx` shortcut list
3. Update `docs/index.html` user manual

### Adding a New Icon Category

1. Add type and update `NodeIcon` union in `types/icons.ts`
2. Add icon definitions to `ICON_DEFINITIONS` in `types/icons.ts`
3. Add category label to `ICON_CATEGORY_LABELS` in `types/icons.ts`
4. Add SVG imports and mapping in `types/iconSvg.ts` (for MindMap canvas rendering)
5. Export new types from `types/index.ts`

### Adding a New Store Action

1. Add action to `documentStore.ts`
2. If undoable, wrap state change with history snapshot
3. Add selector if computed value needed

---

## Development Commands

```bash
cd mindmap-app
pnpm install          # Install dependencies
pnpm tauri dev        # Run development server
pnpm tauri build      # Build for production
```

---

## Important Caveats

1. **Tauri 2.0**: Use v2 docs, not v1 (API differs significantly)
2. **PixiJS 8**: Initialization differs from v7
3. **Zustand 5**: Use `create()` without currying
4. **Tailwind 3**: Not v4 (different config format)
5. **React 19**: Concurrent features available but not heavily used
6. **Root node**: Cannot be deleted, cut, or moved

---

## File Format (.mindmap)

```json
{
  "version": "1.0",
  "metadata": {
    "title": "Document title",
    "created": "2025-01-01T00:00:00Z",
    "modified": "2025-01-01T00:00:00Z"
  },
  "view": {
    "mode": "mindmap",
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  },
  "rootId": "node-uuid-001",
  "nodes": {
    "node-uuid-001": {
      "id": "node-uuid-001",
      "parentId": null,
      "childIds": ["node-uuid-002"],
      "text": "Central Topic",
      "icons": [],
      "position": { "x": 400, "y": 300, "source": "auto" },
      "isCollapsed": false
    }
  }
}
```

---

## Coding Conventions

### TypeScript
- File names: camelCase.ts (components: PascalCase.tsx)
- Explicit type definitions for interfaces
- Arrow functions for utilities, function declarations for components

### React
- Zustand for all shared state, minimal local state
- Use selectors to subscribe to specific state slices
- Side effects in useEffect hooks

### Rust (Tauri)
- Use `#[tauri::command]` for frontend-callable functions
- Return `Result<T, String>` for error handling
- Atomic file writes (temp file + rename)

---

## Quick Reference: Key Files

| Purpose | File |
|---------|------|
| Main state + actions | `src/store/documentStore.ts` |
| Type definitions | `src/types/index.ts` |
| Global keyboard handling | `src/App.tsx` |
| Mind map rendering | `src/components/MindMap/MindMapCanvas.tsx` |
| Outline rendering | `src/components/Outline/OutlineView.tsx` |
| Search & Filter panel | `src/components/Search/SearchPanel.tsx` |
| Node operations | `src/core/operations/` |
| Clipboard logic | `src/core/clipboard/` |
| File I/O | `src/services/tauri/fileSystem.ts` |
| Layout algorithm | `src/core/layout/layoutEngine.ts` |
| Help dialog (cheat sheet) | `src/components/Help/HelpDialog.tsx` |
| Link dialog | `src/components/LinkDialog/LinkDialog.tsx` |
