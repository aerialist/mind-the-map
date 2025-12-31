# Mind the Map

A lightweight, keyboard-centric mind mapping application with dual view modes (mind map and outline).

## Overview

Mind the Map is a desktop application built with Tauri 2.0 that provides a snappy, responsive experience for organizing thoughts and ideas. It features:

- **Keyboard-first interaction** - Navigate and edit entirely with keyboard shortcuts
- **Dual view modes** - Switch seamlessly between mind map and outline views
- **Smart layout** - Automatic layout with manual positioning support
- **Fast & lightweight** - Built with performance as a top priority

## Technology Stack

- **Framework**: Tauri 2.0
- **Frontend**: React 18 + TypeScript 5
- **State Management**: Zustand + Immer
- **Rendering**: PixiJS 8 (for mind map mode)
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Backend**: Rust

## Prerequisites

Before setting up the development environment, ensure you have the following installed:

### Required

1. **Node.js** (v18 or later)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **pnpm** (recommended package manager)
   ```bash
   npm install -g pnpm
   ```
   - Verify: `pnpm --version`

3. **Rust** (latest stable)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
   - Verify: `rustc --version`

4. **Tauri Prerequisites**

   **macOS:**
   ```bash
   xcode-select --install
   ```

   **Windows:**
   - Install [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/mind-the-map.git
cd mind-the-map
```

### 2. Initialize Tauri Project

Since this is a new project, create the Tauri application:

```bash
pnpm create tauri-app mindmap-app
```

Select the following options when prompted:
- Package manager: `pnpm`
- UI template: `React`
- TypeScript: `Yes`
- Additional options: Select as needed

### 3. Install Dependencies

```bash
cd mindmap-app
pnpm install

# Install additional required packages
pnpm add zustand immer pixi.js
pnpm add -D tailwindcss@3 postcss autoprefixer
pnpm add -D @types/node
```

### 4. Configure Tailwind CSS

```bash
./node_modules/.bin/tailwindcss init -p
```

**Note:** We use Tailwind CSS v3 for compatibility. The initialization command uses the local binary since `pnpx` may not work correctly with Tailwind CSS.

### 5. Run Development Server

```bash
pnpm tauri dev
```

This will:
- Start the Vite development server
- Compile the Rust backend
- Launch the application window

## Project Structure

See [CLAUDE.md](./CLAUDE.md) for detailed project structure and architecture.

## Build for Production

```bash
pnpm tauri build
```

The built application will be available in `src-tauri/target/release/bundle/`.

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Development guide and coding conventions
- [mindmap-requirements.md](./mindmap-requirements.md) - Detailed requirements and specifications

## Development Notes

- This project uses **Tauri 2.0** - ensure you reference v2 documentation
- **PixiJS v8** has different initialization compared to v7
- **Zustand v4+** has updated API patterns
- Cross-platform compatibility (macOS/Windows) is a priority

## Troubleshooting

### macOS: "xcrun: error: invalid active developer path"
```bash
xcode-select --install
```

### Windows: Missing WebView2
Download and install from [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

### Rust compilation errors
```bash
rustup update
cargo clean
```

## License

See [LICENSE](./LICENSE) file for details.

## Contributing

This project is in early development. Contribution guidelines will be added soon.
