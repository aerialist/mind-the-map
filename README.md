# Mind the Map

A lightweight, keyboard-centric mind mapping application with dual view modes (mind map and outline).

## Overview

Mind the Map is a desktop application built with Tauri 2.0 that provides a snappy, responsive experience for organizing thoughts and ideas. It features:

- **Keyboard-first interaction** - Core workflows are shortcut-driven (planned actions may appear in menus but remain inactive)
- **Dual view modes** - Switch seamlessly between mind map and outline views
- **Smart layout** - Automatic tree layout with manual positioning support
- **Node icons** - Mark nodes with priority, task progress, flags, arrows, and symbols
- **Smart clipboard** - Paste indented text or HTML lists as structured nodes
- **Fast & lightweight** - Built with performance as a top priority

## Documentation

- **User Manual**: [docs/index.html](./docs/index.html) or [online version](https://aerialist.github.io/mind-the-map/)
- **In-App Help**: Press `?` or `Mod+/` (Cmd+/ on Mac, Ctrl+/ on Windows) to see keyboard shortcuts
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

## Version Management

The project uses version numbers in three places that must be kept in sync:

1. **`mindmap-app/package.json`** - Frontend package version
2. **`mindmap-app/src-tauri/tauri.conf.json`** - Tauri app bundle version
3. **`mindmap-app/src-tauri/Cargo.toml`** - Rust package version

### Why Three Places?

- **package.json**: Standard Node.js/npm package versioning for the frontend
- **tauri.conf.json**: Used by Tauri for app bundle metadata and installers
- **Cargo.toml**: Rust package version, used by the `get_app_version()` command to display in the About dialog

### How to Update Version

When releasing a new version, update all three files:

```bash
# 1. Update package.json
sed -i '' 's/"version": ".*"/"version": "0.2.0"/' mindmap-app/package.json

# 2. Update tauri.conf.json
sed -i '' 's/"version": ".*"/"version": "0.2.0"/' mindmap-app/src-tauri/tauri.conf.json

# 3. Update Cargo.toml
sed -i '' 's/^version = ".*"/version = "0.2.0"/' mindmap-app/src-tauri/Cargo.toml
```

Or manually edit each file to change the version number to match.

## Creating a Release

### Automated Release (via GitHub Actions)

1. **Update the version number** in `mindmap-app/src-tauri/tauri.conf.json`:
   ```json
   {
     "version": "0.2.0"
   }
   ```

2. **Commit and create a tag**:
   ```bash
   git add .
   git commit -m "Release v0.2.0"
   git tag v0.2.0
   git push origin main
   git push origin v0.2.0
   ```

3. **GitHub Actions will automatically**:
   - Build for macOS (Apple Silicon & Intel) and Windows
   - Create a GitHub Release draft
   - Upload all installers as release assets

4. **Publish the release**:
   - Go to your GitHub repository's Releases page
   - Review the draft release
   - Edit the release notes if needed
   - Click "Publish release"

### Manual Release

If you prefer to create releases manually:

1. Build locally: `pnpm tauri build`
2. Navigate to Releases on GitHub
3. Click "Create a new release"
4. Create a new tag (e.g., `v0.2.0`)
5. Upload the built binaries from `src-tauri/target/release/bundle/`
6. Write release notes and publish

## CI/CD Workflows

The project uses two GitHub Actions workflows:

### 1. CI Build (Continuous Integration)
- **Trigger**: Push to `main` branch or pull requests
- **Purpose**: Validate that the code builds successfully on all platforms
- **Platforms**: macOS (Apple Silicon & Intel), Windows
- **Artifacts**: Available for download from GitHub Actions for 7 days

Access development builds:
- Visit the [Actions tab](https://github.com/aerialist/mind-the-map/actions/workflows/ci.yml)
- Click on the latest successful workflow run
- Download artifacts from the "Artifacts" section

Or use direct links (via nightly.link):
- [macOS Apple Silicon](https://nightly.link/aerialist/mind-the-map/workflows/ci/main/tauri-bundle-macos-latest-aarch64-apple-darwin.zip)
- [macOS Intel](https://nightly.link/aerialist/mind-the-map/workflows/ci/main/tauri-bundle-macos-latest-x86_64-apple-darwin.zip)
- [Windows](https://nightly.link/aerialist/mind-the-map/workflows/ci/main/tauri-bundle-windows-latest-x86_64-pc-windows-msvc.zip)

### 2. Release Workflow
- **Trigger**: Push tags matching `v*` (e.g., `v0.2.0`)
- **Purpose**: Create official GitHub releases with installers
- **Output**: Draft release with all platform builds attached

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
    │   │   ├── IconPicker/      # Icons panel (right sidebar)
    │   │   ├── LinkDialog/      # Node link editor
    │   │   └── Search/          # Search & Filter panel
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

Mod = Cmd on macOS, Ctrl on Windows/Linux.

### Core Editing
- Create nodes: `Tab` (child), `Enter` (sibling below), `Mod+Shift+Enter` (sibling above)
- Indent/Outdent nodes: `Mod+]` / `Mod+[`
- Edit nodes: `E`, `F2`, or double-click
- Delete nodes: `Mod+Backspace`
- Navigate: Arrow keys

### Views
- Toggle Mind Map / Outline: `Mod+M`
- Mind Map view: 2D canvas with tree layout, pan & zoom
- Outline view: Hierarchical list with inline editing
- Fit to screen (mind map): `Mod+Shift+F`

### Organization
- Collapse/Expand: `Space` for single node
- Smart Collapse All: `Shift+Alt+Space` cycles through 3 states (collapsed → expanded except completed → fully expanded)
- Node icons: `Mod+Shift+I` to open picker, click any icon on a node to cycle through variants in its category
- Node links: `Mod+K` to add/edit hyperlinks

### Search & Filter (`Mod+F`)
- **Search**: Text-based search with results in sidebar, click to navigate
- **Filter**: Icon-based filtering that hides non-matching nodes from view
- Multiple icon filters can be combined (OR logic)
- Parent nodes remain visible for context

### Clipboard
- Copy/Cut/Paste: Standard shortcuts (`Mod+C`/`Mod+X`/`Mod+V`) with hierarchy preservation
- Paste as child: `Mod+Shift+V`
- External paste: Indented text and HTML lists become structured nodes
- Miro export: `Mod+Shift+M` copies in Miro-compatible table format

### File Operations
- New/Open/Save: `Mod+N`, `Mod+O`, `Mod+S`
- Save As: `Mod+Shift+S`
- Export as PDF: `Mod+Shift+E`
- Print: `Mod+P`
- Auto-save: 30 seconds after changes (if file was previously saved)
- File format: `.mindmap` (JSON)

### History
- Undo/Redo: `Mod+Z`, `Mod+Shift+Z` (or `Mod+Y`)
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
