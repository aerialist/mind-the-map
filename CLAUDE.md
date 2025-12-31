# CLAUDE.md - マインドマップアプリケーション開発ガイド

## プロジェクト概要

軽快でキビキビと動作するマインドマップアプリケーションを開発する。キーボード中心の操作性と、マインドマップ/アウトライン両表示モードを特徴とする。

### 技術スタック

- **フレームワーク**: Tauri 2.0
- **フロントエンド**: React 18 + TypeScript 5
- **状態管理**: Zustand + Immer
- **レンダリング**: PixiJS 8（マインドマップモード）
- **スタイリング**: Tailwind CSS
- **ビルドツール**: Vite
- **バックエンド**: Rust（Tauri）

### プロジェクト名

`mindmap-app`

---

## ディレクトリ構造

```
mindmap-app/
├── CLAUDE.md                    # このファイル
├── README.md                    # プロジェクト説明
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── index.html
│
├── src/                         # フロントエンド（TypeScript/React）
│   ├── main.tsx                 # エントリポイント
│   ├── App.tsx                  # ルートコンポーネント
│   │
│   ├── types/                   # 型定義
│   │   ├── index.ts             # 型のエクスポート
│   │   ├── node.ts              # Node関連の型
│   │   ├── document.ts          # Document関連の型
│   │   └── events.ts            # イベント関連の型
│   │
│   ├── store/                   # 状態管理（Zustand）
│   │   ├── index.ts             # ストアのエクスポート
│   │   ├── documentStore.ts     # ドキュメント状態
│   │   ├── uiStore.ts           # UI状態（選択、ビューポート等）
│   │   ├── historyStore.ts      # Undo/Redo履歴
│   │   └── selectors.ts         # セレクタ関数
│   │
│   ├── core/                    # コアロジック（UIに依存しない）
│   │   ├── operations/          # ノード操作
│   │   │   ├── index.ts
│   │   │   ├── createNode.ts
│   │   │   ├── deleteNode.ts
│   │   │   ├── updateNode.ts
│   │   │   └── moveNode.ts
│   │   ├── layout/              # レイアウト計算
│   │   │   ├── index.ts
│   │   │   ├── layoutEngine.ts
│   │   │   ├── algorithms/
│   │   │   │   ├── tree.ts
│   │   │   │   └── radial.ts
│   │   │   └── worker.ts        # Web Worker
│   │   ├── navigation/          # ノード間ナビゲーション
│   │   │   └── index.ts
│   │   └── serialization/       # 保存/読み込み
│   │       ├── index.ts
│   │       ├── serialize.ts
│   │       └── deserialize.ts
│   │
│   ├── components/              # Reactコンポーネント
│   │   ├── App/
│   │   │   └── AppLayout.tsx
│   │   ├── Toolbar/
│   │   │   ├── Toolbar.tsx
│   │   │   └── ToolbarButton.tsx
│   │   ├── MindMap/             # マインドマップモード
│   │   │   ├── MindMapCanvas.tsx
│   │   │   ├── NodeRenderer.ts  # PixiJS描画
│   │   │   ├── EdgeRenderer.ts
│   │   │   └── ViewportController.ts
│   │   ├── Outline/             # アウトラインモード
│   │   │   ├── OutlineView.tsx
│   │   │   ├── OutlineNode.tsx
│   │   │   └── OutlineEditor.tsx
│   │   ├── PropertyPanel/
│   │   │   └── PropertyPanel.tsx
│   │   ├── Search/
│   │   │   └── SearchDialog.tsx
│   │   └── common/              # 共通コンポーネント
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── Dialog.tsx
│   │
│   ├── hooks/                   # カスタムフック
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useNodeNavigation.ts
│   │   ├── useAutoSave.ts
│   │   ├── useViewport.ts
│   │   └── useFileOperations.ts
│   │
│   ├── services/                # 外部サービス連携
│   │   └── tauri/               # Tauri API呼び出し
│   │       ├── index.ts
│   │       ├── fileSystem.ts
│   │       └── dialogs.ts
│   │
│   └── styles/                  # グローバルスタイル
│       └── index.css
│
├── src-tauri/                   # バックエンド（Rust）
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   ├── src/
│   │   ├── main.rs              # エントリポイント
│   │   ├── lib.rs               # ライブラリルート
│   │   ├── commands/            # Tauriコマンド
│   │   │   ├── mod.rs
│   │   │   ├── file.rs          # ファイル操作
│   │   │   └── recent.rs        # 最近のファイル
│   │   └── utils/
│   │       └── mod.rs
│   └── icons/                   # アプリアイコン
│
└── tests/                       # テスト
    ├── unit/
    └── e2e/
```

---

## 開発フェーズ

### Phase 1: アウトラインモード基本機能 ✅ 完了

1. **プロジェクトセットアップ** ✅
   - Tauri 2.0 + React + TypeScript プロジェクト初期化
   - 基本的な依存関係インストール（zustand, immer, tailwindcss@3）

2. **データモデル実装** ✅
   - 型定義（Node, Document, Position等）
   - Zustandストア + Immerミドルウェア
   - 基本的なノード操作（CRUD）

3. **アウトラインモード** ✅
   - 階層リスト表示
   - ノード選択（クリック）
   - キーボードナビゲーション（矢印キー）
   - テキスト編集（Enter/F2で編集、Escapeで確定）
   - 子ノード作成（Tab）
   - 兄弟ノード作成（編集中にEnter）
   - ノード削除（Delete/Backspace）
   - 折りたたみ/展開（Space、またはインジケータクリック）

### Phase 2: ファイル操作 ✅ 完了

1. **シリアライズ/デシリアライズ** ✅
   - JSON形式での保存
   - バージョン管理付きファイルフォーマット

2. **Tauriファイルダイアログ連携** ✅
   - tauri-plugin-dialog導入
   - 保存ダイアログ（.mindmap拡張子）
   - 開くダイアログ

3. **ファイル操作キーボードショートカット** ✅
   - Ctrl+S（保存）、Ctrl+Shift+S（名前を付けて保存）
   - Ctrl+O（開く）
   - Ctrl+N（新規作成）
   - タイトルバーにファイル名と変更インジケータ（*）表示

### Phase 3: マインドマップモード ✅ 完了

1. **PixiJSキャンバス** ✅
   - 基本的なノード描画
   - エッジ（接続線）描画（ベジェ曲線）
   - パン・ズーム（マウスドラッグとホイール）

2. **レイアウトエンジン** ✅
   - ツリーレイアウトアルゴリズム

3. **モード切替** ✅
   - Ctrl+1（マインドマップ）、Ctrl+2（アウトライン）
   - ヘッダーのMap/Outlineボタン
   - ダブルクリックでアウトラインモードに切り替えて編集開始

### Phase 4: 機能拡充（次のフェーズ）

1. **マインドマップモードでの編集**（現在はダブルクリックでアウトラインモードに切り替えて編集）
2. **Undo/Redo**
3. **ノードドラッグ移動**
4. **検索機能**
5. **自動保存**

---

## コーディング規約

### TypeScript

```typescript
// ファイル名: camelCase.ts（コンポーネントはPascalCase.tsx）

// 型定義は明示的に
interface Node {
  id: string;
  parentId: string | null;
  childIds: string[];
  content: NodeContent;
  position: Position;
  isCollapsed: boolean;
}

// Union型を活用
type NodeContent = 
  | { type: 'text'; text: string }
  | { type: 'image'; url: string };

// 関数は arrow function を基本とする
const createNode = (parentId: string): Node => {
  // ...
};

// コンポーネントは function 宣言
function NodeComponent({ node }: { node: Node }) {
  return <div>{node.content.text}</div>;
}
```

### React

```typescript
// 状態管理はZustandを使用
// ローカル状態は最小限に

// セレクタで必要な状態のみ購読
const selectedNodeId = useStore((state) => state.selectedNodeId);

// アクションは直接取得
const createNode = useStore((state) => state.createNode);

// 副作用はuseEffectに集約
useEffect(() => {
  // キーボードイベント等
}, [dependencies]);
```

### Rust

```rust
// Tauriコマンドは #[tauri::command] を使用
#[tauri::command]
async fn save_document(path: String, content: String) -> Result<(), String> {
    // エラーは Result で返す
    std::fs::write(&path, &content).map_err(|e| e.to_string())
}
```

---

## 重要な設計方針

### 1. パフォーマンス最優先

```typescript
// NG: 全ノードを毎回レンダリング
{Object.values(nodes).map(node => <Node key={node.id} node={node} />)}

// OK: 可視ノードのみレンダリング
{visibleNodeIds.map(id => <Node key={id} nodeId={id} />)}

// 個別コンポーネントで自身の状態のみ購読
function Node({ nodeId }: { nodeId: string }) {
  const node = useStore((state) => state.nodes[nodeId]);
  // ...
}
```

### 2. キーボード操作の即時性

```typescript
// キー入力は同期的に処理
const handleKeyDown = (e: KeyboardEvent) => {
  // 即座に状態更新
  if (e.key === 'Tab') {
    e.preventDefault();
    createChildNode();
  }
};

// レイアウト計算は非同期（Web Worker）
layoutWorker.postMessage({ nodes });
```

### 3. 手動配置の尊重

```typescript
interface Position {
  x: number;
  y: number;
  source: 'auto' | 'manual';  // 配置の由来を記録
}

// 自動レイアウト時、手動配置ノードは移動しない
const calculateLayout = (nodes: Node[]) => {
  const fixedNodes = nodes.filter(n => n.position.source === 'manual');
  // fixedNodesを固定点として他を配置
};
```

### 4. モード間の一貫性

```typescript
// 同じストアを両モードで共有
// 選択状態、折りたたみ状態は同期される

// モード切替時
const switchMode = (mode: 'mindmap' | 'outline') => {
  // 選択ノードが画面内に来るよう調整
  ensureNodeVisible(selectedNodeId);
  setViewMode(mode);
};
```

---

## キーボードショートカット実装

```typescript
// hooks/useKeyboardShortcuts.ts

const shortcuts: ShortcutMap = {
  // 基本操作
  'Tab': { action: 'createChild', mode: 'both' },
  'Enter': { action: 'createSibling', mode: 'both', condition: 'notEditing' },
  'Space': { action: 'toggleCollapse', mode: 'both' },
  'Delete': { action: 'deleteNode', mode: 'both' },
  'Backspace': { action: 'deleteNode', mode: 'both' },
  
  // ナビゲーション
  'ArrowUp': { action: 'navigateUp', mode: 'both' },
  'ArrowDown': { action: 'navigateDown', mode: 'both' },
  'ArrowLeft': { action: 'navigateLeft', mode: 'both' },
  'ArrowRight': { action: 'navigateRight', mode: 'both' },
  
  // モード切替
  'Ctrl+1': { action: 'switchToMindmap', mode: 'both' },
  'Ctrl+2': { action: 'switchToOutline', mode: 'both' },
  
  // ファイル操作
  'Ctrl+s': { action: 'save', mode: 'both' },
  'Ctrl+o': { action: 'open', mode: 'both' },
  'Ctrl+n': { action: 'new', mode: 'both' },
  
  // 編集
  'Ctrl+z': { action: 'undo', mode: 'both' },
  'Ctrl+Shift+z': { action: 'redo', mode: 'both' },
  'Ctrl+f': { action: 'search', mode: 'both' },
  
  // アウトラインモード専用
  'Shift+Tab': { action: 'outdent', mode: 'outline' },
};
```

---

## Tauri連携

### コマンド定義

```rust
// src-tauri/src/commands/file.rs

#[tauri::command]
pub async fn save_document(path: String, content: String) -> Result<(), String> {
    // 一時ファイルに書き込み後、リネーム（アトミック保存）
    let temp_path = format!("{}.tmp", path);
    std::fs::write(&temp_path, &content).map_err(|e| e.to_string())?;
    std::fs::rename(&temp_path, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn read_document(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
```

### フロントエンドからの呼び出し

```typescript
// services/tauri/fileSystem.ts
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';

export const saveDocument = async (document: Document): Promise<void> => {
  const path = await save({
    filters: [{ name: 'Mind Map', extensions: ['mindmap'] }],
  });
  
  if (path) {
    const content = JSON.stringify(document);
    await invoke('save_document', { path, content });
  }
};

export const openDocument = async (): Promise<Document | null> => {
  const path = await open({
    filters: [{ name: 'Mind Map', extensions: ['mindmap'] }],
  });
  
  if (path) {
    const content = await invoke<string>('read_document', { path });
    return JSON.parse(content);
  }
  return null;
};
```

---

## テスト方針

### ユニットテスト

```typescript
// コアロジックは純粋関数としてテスト可能に
// tests/unit/operations/createNode.test.ts

describe('createNode', () => {
  it('creates a child node', () => {
    const state = createInitialState();
    const newState = createNode(state, 'parent-id', 'New Node');
    
    expect(Object.keys(newState.nodes)).toHaveLength(2);
    expect(newState.nodes['parent-id'].childIds).toContain(newState.selectedNodeId);
  });
});
```

### 結合テスト

```typescript
// Zustandストアのテスト
describe('documentStore', () => {
  it('handles undo/redo', () => {
    // ...
  });
});
```

---

## 参考リソース

- [要件定義書](./mindmap-requirements.md) - 詳細な機能要件・非機能要件・ユーザーストーリー
- [Tauri 2.0 Documentation](https://v2.tauri.app/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [PixiJS Documentation](https://pixijs.com/guides)

---

## 開発ステップ（段階的実装）

各ステップは独立して動作確認可能。一つずつ実装してアプリを実行し、動作を確認してから次へ進む。

### Phase 1: アウトラインモード基本機能 ✅ 完了

| Step | 機能 | 確認方法 | 状態 |
|------|------|----------|------|
| 1 | 型定義（Node, Document, Position） | TypeScriptがエラーなくコンパイル | ✅ |
| 2 | Zustandストア + 初期状態 | アプリに「中心トピック」が表示される | ✅ |
| 3 | 基本的なアウトラインビュー | ノードが階層リストで表示される | ✅ |
| 4 | ノード選択（クリック） | クリックでノードがハイライトされる | ✅ |
| 5 | キーボードナビゲーション（矢印キー） | 矢印キーで選択が移動する | ✅ |
| 6 | テキスト編集（Enter/Escape） | Enterで編集、入力、Escapeで確定 | ✅ |
| 7 | 子ノード作成（Tab） | Tabで子ノードが作成される | ✅ |
| 8 | 兄弟ノード作成（Enter） | 編集中にEnterで兄弟作成 | ✅ |
| 9 | ノード削除（Delete/Backspace） | 選択ノードが削除される | ✅ |
| 10 | 折りたたみ/展開（Space） | Spaceで子ノードの表示切替 | ✅ |

### Phase 2: ファイル操作 ✅ 完了

| Step | 機能 | 確認方法 | 状態 |
|------|------|----------|------|
| 11 | シリアライズ/デシリアライズ | JSON形式でのドキュメント変換 | ✅ |
| 12 | Tauriダイアログプラグイン | ファイルダイアログが表示される | ✅ |
| 13 | Rustファイルコマンド | 保存/読み込みが動作する | ✅ |
| 14 | ファイル保存（Ctrl+S） | .mindmapファイルとして保存 | ✅ |
| 15 | ファイル読み込み（Ctrl+O） | 保存したファイルを開ける | ✅ |
| 16 | 新規作成（Ctrl+N） | 新しい空のマップを作成 | ✅ |

### Phase 3: マインドマップモード ✅ 完了

| Step | 機能 | 確認方法 | 状態 |
|------|------|----------|------|
| 17 | PixiJSキャンバス表示 | キャンバスが表示される | ✅ |
| 18 | ノード描画 | ノードが2D空間に表示される | ✅ |
| 19 | エッジ（接続線）描画 | 親子間に線が表示される | ✅ |
| 20 | パン・ズーム | マウスドラッグとホイールで操作 | ✅ |
| 21 | モード切替（Ctrl+1/2） | マインドマップ⇔アウトライン切替 | ✅ |

### Phase 4: 機能拡充（次のフェーズ）

| Step | 機能 | 確認方法 | 状態 |
|------|------|----------|------|
| 22 | マインドマップモードでの編集 | ダブルクリックでその場編集 | |
| 23 | Undo/Redo | Ctrl+Z/Ctrl+Shift+Zで操作取消 | |
| 24 | ノードドラッグ移動 | ドラッグでノード位置変更 | |
| 25 | 検索機能 | Ctrl+Fで検索ダイアログ | |
| 26 | 自動保存 | 編集後30秒で自動保存 | |

---

## 注意事項

- Tauri 2.0 は 1.x と API が異なる。必ず v2 のドキュメントを参照すること
- PixiJS は v8 を使用。v7 以前とは初期化方法が異なる
- Zustand は v4 以降、`create` の使い方が変わっている
- macOS/Windows両対応を常に意識すること（パス区切り文字等）
