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
| Unit Testing | Vitest + React Testing Library | 4.x / 16.x |
| E2E Testing | Playwright | 1.57.x |

### Key Design Principles

1. **Keyboard-first**: Core actions have shortcuts; planned actions may appear in menus but remain inactive
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
    │   ├── services/            # App-level services
    │   │   ├── commandBus.ts    # Command bus + default handlers
    │   │   └── tauri/           # Tauri API wrappers
    │   │       ├── fileSystem.ts
    │   │       ├── safeTauri.ts # Safe wrappers for browser-only mode
    │   │       └── index.ts
    │   │
    │   ├── test/                # Test setup
    │   │   └── setup.ts         # Vitest setup with Tauri API mocks
    │   │
    │   └── utils/
    │       └── nodeInputHandlers.ts  # Shared input/textarea key handling
    │
    ├── e2e/                     # Playwright E2E tests
    │   ├── app.spec.ts          # Basic app functionality tests
    │   ├── node-operations.spec.ts  # Node CRUD and navigation tests
    │   └── keyboard-shortcuts.spec.ts # Keyboard shortcut tests
    │
    └── src-tauri/               # Rust backend
        └── src/                 # Tauri app entry (menus, commands)
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

Mod = Cmd on macOS, Ctrl on Windows/Linux. Items marked "(planned)" exist in menus but are inactive.
In-app shortcuts listing is maintained in `mindmap-app/src/components/Help/HelpDialog.tsx`.

### File
| Key | Action | Notes |
|-----|--------|-------|
| Mod+N | New Document | |
| Mod+O | Open... | |
| Mod+S | Save | |
| Mod+Shift+S | Save As... | |
| Mod+Shift+E | Export as PDF | |
| Mod+P | Print... | |
| Mod+, | Preferences... | (planned) |
| Cmd+Q / Alt+F4 | Quit | macOS / Windows |

### Edit
| Key | Action | Notes |
|-----|--------|-------|
| Mod+Z | Undo | |
| Mod+Shift+Z / Mod+Y | Redo | |
| Mod+X | Cut | |
| Mod+C | Copy | |
| Mod+V | Paste | |
| Mod+Shift+V | Paste as Child | |
| Mod+D | Duplicate Node | (planned) |
| Mod+Backspace | Delete Node | Root protected |
| Mod+Shift+Backspace | Delete Node & Children | (planned) |
| Mod+A | Select All (in text) | |
| Mod+Shift+A | Select All Siblings | (planned) |
| Mod+Alt+A | Select All Children | (planned) |
| Mod+F | Find... | Toggles Search & Filter panel |
| Mod+G | Find Next | (planned) |
| Mod+Shift+G | Find Previous | (planned) |
| Mod+Shift+P | Go to Node... | (planned) |
| Mod+Shift+D | Jump to Daily Note | (planned) |
| Mod+R | Recent Nodes | (planned) |

### Insert
| Key | Action | Notes |
|-----|--------|-------|
| Enter | New Sibling Node Below | |
| Mod+Shift+Enter | New Sibling Node Above | |
| Tab | New Child Node | |
| Shift+Enter | Line Break (in node) | (planned) |
| Mod+K | Link... | |
| Mod+T | Tag | (planned) |
| Mod+Shift+N | Note | (planned) |
| Mod+Shift+I | Icon... | |
| Mod+Shift+C | Checkbox | (planned) |
| Mod+Shift+K | Color/Style... | (planned) |
| Mod+Shift+P | Priority | (planned) |

### Format
| Key | Action | Notes |
|-----|--------|-------|
| Mod+B | Bold | (planned) |
| Mod+I | Italic | (planned) |
| Mod+U | Underline | (planned) |
| Mod+Shift+X | Strikethrough | (planned) |
| Mod+E | Code | (planned) |
| Mod+\ | Clear Formatting | (planned) |

### Node
| Key | Action | Notes |
|-----|--------|-------|
| Mod+] | Indent | |
| Mod+[ | Outdent | |
| Space | Expand/Collapse | |
| Mod+Shift+Up/Down/Left/Right | Move Node (Up/Down/Left/Right) | (planned) |
| Mod+Alt+Right/Left | Expand/Collapse All Children | |
| Mod+. | Zoom to Node (Focus) | (planned) |
| Mod+, | Zoom Out from Node | (planned) |
| Mod+Home | Jump to Root | (planned) |

### Navigate
| Key | Action | Notes |
|-----|--------|-------|
| Up/Down | Move to Sibling Above/Below | |
| Left | Move to Parent | |
| Right | Move to First Child | |
| Mod+Up | Jump to First Sibling | (planned) |
| Mod+Down | Jump to Last Sibling | (planned) |
| Mod+Right | Jump to Last Child | (planned) |
| Shift+Up/Down | Extend Selection | (planned) |
| Mod+Enter | Select/Deselect Node | (planned) |

### View
| Key | Action | Notes |
|-----|--------|-------|
| Mod+M | Toggle Outline/Mindmap | |
| Mod+Shift+F | Fit to Screen | Mind map only |
| Mod+Plus / Mod+Minus / Mod+0 | Zoom In/Out/Reset | (planned) |
| Mod+Shift+H | Show/Hide Completed | (planned) |
| Mod+Shift+. | Focus Mode (Hide UI) | (planned) |
| Mod+B | Toggle Sidebar | (planned) |
| Mod+1 | Actual Size | (planned) |
| Ctrl+Cmd+F / F11 | Enter Full Screen | macOS / Windows |

### Help
| Key | Action |
|-----|--------|
| ? / Mod+/ | Open shortcuts help |

### Hidden / Power User (not in menus)
| Key | Action | Notes |
|-----|--------|-------|
| E / F2 | Start editing selected node | |
| Escape | Save and stop editing | |
| Ctrl+Escape | Cancel editing | Discards changes |
| Shift+Space | Smart collapse all (3-state) | |
| Mod+Shift+M | Copy for Miro | Table format |

### Multi-Selection
| Action | Result |
|--------|--------|
| Mod+Click | Toggle node in selection |
| Shift+Click | Range select |

### Mouse Actions
| Action | Result |
|--------|--------|
| Double-click node | Start editing |
| Click icon on node | Cycle to next variant in category |
| Right-click + drag (Mind Map) | Pan canvas |
| Mouse wheel (Mind Map) | Zoom in/out |

---

## Implementation Notes

### IME Support (Japanese/Chinese Input)
- `compositionstart`/`compositionend` events track IME state
- Enter during composition confirms character, not node operation
- Use `handleNodeInputKeyDown` in `src/utils/nodeInputHandlers.ts` to share IME-safe behavior across inputs

### Command Bus & Active Window Routing
- All actions are expressed as command IDs (e.g., `node.createChild`, `file.save`)
- Frontend calls `dispatch(commandId, args?)` from `src/services/commandBus.ts`
- Rust resolves the active window label, then emits `command:dispatch` to that window
- Frontend notifies Rust of focus via `window_activated` and `getCurrentWindow().onFocusChanged`
- Default command handlers live in `src/services/commandBus.ts`; components can add handlers via `registerCommandHandler`

### Smart Collapse (Shift+Space)
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
- Implemented inside `src/components/MindMap/MindMapCanvas.tsx`
- Respects `position.source === 'manual'` nodes
- Calculates positions for `source === 'auto'` nodes only
- Avoids overlaps between all nodes

### Search & Filter Panel (Ctrl+F)
The Search & Filter panel is a right sidebar with three distinct sections:

**Search (text-based)**:
- Text search through all node content
- Results listed in sidebar for quick navigation
- Click result to select and scroll to node
- Panel stays open while working

**Filter View (icon-based, blue)**:
- Shows ONLY nodes with selected icons (and their ancestors for context)
- Multiple filters can be active simultaneously (OR logic)
- Parent nodes remain visible to maintain tree context
- Works in both Mind Map and Outline views

**Hide View (icon-based, red)**:
- Hides nodes with selected icons, showing everything else
- Opposite behavior from Filter View
- Can be used independently or combined with Filter View
- When both are active: first apply hidden filters, then apply active filters

Key implementation:
- `activeIconFilters`: Currently selected icon filters (show only)
- `hiddenIconFilters`: Currently selected hidden filters (hide)
- `availableIcons`: All icons found in the document (refreshed on panel open)
- `computeVisibleNodeIds()`: Returns Set of node IDs that should be visible (handles both filter modes)
- `VisibleNodesContext`: React context to pass visibility down the OutlineNode tree

---

## Common Development Tasks

### Adding a New Keyboard Shortcut

1. Add a command handler in `src/services/commandBus.ts` (or `registerCommandHandler` in a component)
2. Wire the shortcut to `dispatch(commandId)` in `App.tsx` or the relevant component
3. If coming from a native menu item, map the menu ID to the command ID in `src-tauri/src/lib.rs`
4. Update `HelpDialog.tsx` shortcut list
5. Update `docs/index.html` user manual

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

## Testing

The project includes comprehensive unit and E2E tests.

### Test Commands

```bash
cd mindmap-app
pnpm test             # Run unit tests (Vitest)
pnpm test:watch       # Run unit tests in watch mode
pnpm test:coverage    # Run unit tests with coverage report
pnpm test:e2e         # Run E2E tests (Playwright)
pnpm test:e2e:ui      # Run E2E tests with interactive UI
pnpm test:e2e:headed  # Run E2E tests in headed browser mode
pnpm test:all         # Run all tests (unit + E2E)
```

### Unit Tests (Vitest + React Testing Library)

Unit tests are located alongside their source files with `.test.ts` suffix:

| Test File | Coverage |
|-----------|----------|
| `src/store/documentStore.test.ts` | Zustand store actions, selection, history |
| `src/core/navigation/navigation.test.ts` | Keyboard navigation logic |
| `src/core/clipboard/clipboard.test.ts` | Copy/paste, HTML/text parsing |
| `src/core/serialization/serialization.test.ts` | JSON file format handling |
| `src/utils/nodeInputHandlers.test.ts` | Input key event handling, IME support |

**Test setup** (`src/test/setup.ts`):
- Mocks Tauri APIs (`@tauri-apps/api/core`, `@tauri-apps/api/event`, etc.)
- Configures jsdom environment
- Sets up Testing Library matchers

### E2E Tests (Playwright)

E2E tests are in the `e2e/` directory:

| Test File | Coverage |
|-----------|----------|
| `e2e/app.spec.ts` | Basic app functionality, smoke tests |
| `e2e/node-operations.spec.ts` | Node CRUD, navigation, editing |
| `e2e/keyboard-shortcuts.spec.ts` | All keyboard shortcuts |

**Browser-only mode**: E2E tests run against `pnpm dev` (Vite only) using safe Tauri wrappers (`src/services/tauri/safeTauri.ts`) that provide mock implementations when Tauri APIs are unavailable.

### Writing New Tests

**Unit test example:**
```typescript
// src/core/myFeature/myFeature.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from './myFeature';

describe('myFunction', () => {
  it('should do something', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

**E2E test example:**
```typescript
// e2e/myFeature.spec.ts
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Meta+f');
  await expect(page.getByText('Search')).toBeVisible();
});
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
| Command bus + routing | `src/services/commandBus.ts` |
| Shared input key handling | `src/utils/nodeInputHandlers.ts` |
| Mind map rendering | `src/components/MindMap/MindMapCanvas.tsx` |
| Outline rendering | `src/components/Outline/OutlineView.tsx` |
| Search & Filter panel | `src/components/Search/SearchPanel.tsx` |
| Clipboard logic | `src/core/clipboard/` |
| Navigation logic | `src/core/navigation/` |
| Serialization | `src/core/serialization/` |
| File I/O | `src/services/tauri/fileSystem.ts` |
| Safe Tauri wrappers | `src/services/tauri/safeTauri.ts` |
| Help dialog (cheat sheet) | `src/components/Help/HelpDialog.tsx` |
| Link dialog | `src/components/LinkDialog/LinkPanel.tsx` |
| Test setup | `src/test/setup.ts` |
| E2E tests | `e2e/*.spec.ts` |
| Playwright config | `playwright.config.ts` |
