# Mind the Map

A lightweight, keyboard-centric mind mapping application with dual view modes (mind map and outline).

## Overview

Mind the Map is a desktop application built with Tauri 2.0 that provides a snappy, responsive experience for organizing thoughts and ideas. It features:

- **Keyboard-first interaction** - Navigate and edit entirely with keyboard shortcuts
- **Dual view modes** - Switch seamlessly between mind map and outline views
- **Smart layout** - Automatic tree layout with manual positioning support
- **Node icons** - Mark nodes with priority, task progress, flags, arrows, and symbols
- **Smart clipboard** - Paste indented text or HTML lists as structured nodes
- **Fast & lightweight** - Built with performance as a top priority

## Documentation

- **User Manual**: [docs/index.html](./docs/index.html) or [online version](https://aerialist.github.io/mind-the-map/)
- **In-App Help**: Press `?` or `Ctrl+/` (Cmd+/ on Mac) to see keyboard shortcuts
- **AI Development Guide**: [CLAUDE.md](./CLAUDE.md) for AI-assisted development context

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Tauri | 2.x |
| Frontend | React + TypeScript | 19.x / 5.8 |
| State Management | Zustand + Immer | 5.x / 11.x |
| Rendering | PixiJS | 8.x |
| Styling | Tailwind CSS | 3.x |
| Build Tool | Vite | 7.x |
| Icons | Lucide React | 0.562.x |
| Backend | Rust | - |

## Prerequisites

### Required

1. **Node.js** (v18 or later)
   ```bash
   node --version
   ```

2. **pnpm** (recommended package manager)
   ```bash
   npm install -g pnpm
   pnpm --version
   ```

3. **Rust** (latest stable)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustc --version
   ```

4. **Platform-specific dependencies**

   **macOS:**
   ```bash
   xcode-select --install
   ```

   **Windows:**
   - Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

## Development Setup

### Quick Start

```bash
# Clone the repository
git clone https://github.com/aerialist/mind-the-map.git
cd mind-the-map

# Install dependencies
cd mindmap-app
pnpm install

# Run development server
pnpm tauri dev
```

### Build for Production

```bash
pnpm tauri build
```

The built application will be available in `src-tauri/target/release/bundle/`.

## Project Structure

```
mind-the-map/
├── README.md                    # This file (developer guide)
├── CLAUDE.md                    # AI development context
├── docs/
│   └── index.html               # User manual (web page)
│
└── mindmap-app/                 # Application source
    ├── src/                     # Frontend (TypeScript/React)
    │   ├── components/          # React components
    │   │   ├── Help/            # Help dialog (cheat sheet)
    │   │   ├── MindMap/         # PixiJS canvas rendering
    │   │   ├── Outline/         # Outline view components
    │   │   ├── IconPicker/      # Node icon picker
    │   │   └── Search/          # Search dialog
    │   ├── store/               # Zustand state management
    │   ├── core/                # Core logic (UI-independent)
    │   ├── hooks/               # Custom React hooks
    │   └── services/            # Tauri API integration
    │
    └── src-tauri/               # Backend (Rust)
        └── src/
            └── commands/        # Tauri commands (file I/O)
```

## Key Features Implemented

### Core Editing
- Create nodes: `Tab` (child), `Enter` (sibling below), `Shift+Enter` (sibling above)
- Edit nodes: `E`, `F2`, or double-click
- Delete nodes: `Delete` or `Backspace`
- Navigate: Arrow keys

### Views
- Mind Map view (`Ctrl+1`): 2D canvas with tree layout, pan & zoom
- Outline view (`Ctrl+2`): Hierarchical list with inline editing

### Organization
- Collapse/Expand: `Space` for single node
- Smart Collapse All: `Shift+Alt+Space` cycles through 3 states (collapsed → expanded except completed → fully expanded)
- Node icons: `I` to open picker, click icons to cycle variants

### Clipboard
- Copy/Cut/Paste: Standard shortcuts with hierarchy preservation
- External paste: Indented text and HTML lists become structured nodes
- Miro export: `Ctrl+Shift+M` copies in Miro-compatible table format

### File Operations
- New/Open/Save: `Ctrl+N`, `Ctrl+O`, `Ctrl+S`
- Auto-save: 30 seconds after changes (if file was previously saved)
- File format: `.mindmap` (JSON)

### History
- Undo/Redo: `Ctrl+Z`, `Ctrl+Shift+Z` (or `Ctrl+Y`)
- 50 operations history

## Development Notes

- **Tauri 2.0**: Use v2 documentation (API differs from v1)
- **PixiJS v8**: Initialization differs from v7
- **Zustand v5**: Updated API patterns from v4
- **Cross-platform**: Test on both macOS and Windows

## Troubleshooting

### macOS: "xcrun: error: invalid active developer path"
```bash
xcode-select --install
```

### Windows: Missing WebView2
Download from [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Rust compilation errors
```bash
rustup update
cargo clean
```

### Vite/React issues
```bash
rm -rf node_modules
pnpm install
```

## License

See [LICENSE](./LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
