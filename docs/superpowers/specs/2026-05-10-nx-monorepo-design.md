# Nxモノレポ ゲーム開発基盤 設計書

- **作成日**: 2026-05-10
- **対象ブランチ**: `main`
- **スコープ**: 既存の最小Nxワークスペースを、複数ゲーム + 共有ライブラリを開発可能なモノレポに拡張する

## 1. 目的とスコープ

### 目的

複数のゲームアプリを並行して開発でき、共通エンジン/UI/オーディオ基盤を共有するNxモノレポを構築する。テスト駆動開発、自動フォーマット、サブエージェントによるlint/test、Superpowers運用を初期から有効化する。

### このスペックでやること

- 既存Nxワークスペース（`@nx/js` v22.7.0）をベースに React/Vite/Pixi.js 系プラグインを追加
- `apps/sample-game`（初期検証用）と `packages/{ui,game-core,audio,config-*}` をスキャフォールド
- pnpm Catalogs で依存バージョンを単一ソース化
- Biome を導入し Prettier を撤去
- Claude Hooks による自動フォーマット、サブエージェント駆動の lint/test、失敗時の自動記録運用を設定

### このスペックでやらないこと

- 実ゲームコンテンツの実装（sample-gameは動作検証用の最小ゲームのみ）
- Nx Cloud の有効化（初期は無効）
- マルチプレイヤー / バックエンド構成
- リリース運用（`nx release`）

## 2. アーキテクチャ

### 2.1 ディレクトリ構成

```
game-workspace/
├── apps/
│   └── sample-game/                 Vite + React + Pixi.js
├── packages/
│   ├── ui/                          React + Tailwind 共有UI
│   ├── game-core/                   Pixi + Zustand + Zod ゲーム基盤
│   ├── audio/                       howler.js + use-sound
│   ├── config-biome/                biome.json 共有
│   ├── config-tsconfig/             base/lib/app の3層
│   ├── config-tailwind/             tailwind preset
│   └── config-vitest/               node/react/pixi の3 preset
├── memory/                          失敗事例の記録
├── rules/                           汎用化された失敗回避ルール
├── docs/superpowers/specs/          設計ドキュメント
└── .claude/                         settings.json, hooks, commands
```

### 2.2 依存方向

- `apps/*` → `packages/{ui,game-core,audio}` → `packages/config-*`
- `packages/ui` → `packages/audio` のみ許容
- `packages/game-core` は他 packages に依存しない（純粋な基盤）
- 双方向依存禁止、Nxの自動グラフ検証で担保

### 2.3 Nxプラグイン構成

| プラグイン | 役割 |
|-----------|------|
| `@nx/js`（既存） | TypeScript ビルド/typecheck の inferred-tasks |
| `@nx/react` | React app/lib generator |
| `@nx/vite` | vite/vitest の inferred-tasks |
| `@nx/playwright` | Playwright e2e の inferred-tasks |

ESLint プラグインは導入しない（Biome で代替）。Biome は公式Nxプラグインが無いため、プロジェクトごとの `package.json` スクリプトとして配線する。

## 3. パッケージマネージャー / バージョン管理

### 3.1 pnpm Catalogs

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

catalog:
  # React
  react: ^19.0.0
  react-dom: ^19.0.0
  '@types/react': ^19.0.0
  '@types/react-dom': ^19.0.0

  # ビルド/バンドル
  vite: ^7.0.0
  '@vitejs/plugin-react': ^5.0.0

  # スタイリング
  tailwindcss: ^4.0.0
  '@tailwindcss/vite': ^4.0.0

  # 状態管理 / バリデーション
  zustand: ^5.0.0
  zod: ^4.0.0

  # ゲーム
  pixi.js: ^8.0.0
  '@pixi/react': ^8.0.0
  howler: ^2.2.4
  '@types/howler': ^2.2.12
  use-sound: ^5.0.0

  # テスト
  vitest: ^3.0.0
  '@vitest/ui': ^3.0.0
  '@testing-library/react': ^16.0.0
  '@testing-library/jest-dom': ^6.0.0
  jsdom: ^26.0.0
  '@playwright/test': ^1.50.0

  # Linter/Formatter
  '@biomejs/biome': ^2.0.0

  # TypeScript
  typescript: ~5.9.2
```

各 `package.json` では `"react": "catalog:"` のように参照する。バージョン更新は `pnpm-workspace.yaml` 一箇所のみ。

### 3.2 ワークスペース内パッケージの参照

ワークスペース内の自パッケージは `"@org/ui": "workspace:*"` で参照。Nxのグラフが解決する。

## 4. 共有設定パッケージ（config-*）

### 4.1 `packages/config-biome`

`biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "error" },
      "style": {
        "useBlockStatements": "error",
        "noParameterAssign": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
```

各パッケージのルートに薄い `biome.json` を置き、`"extends": ["@org/config-biome/biome.json"]` で継承する。

### 4.2 `packages/config-tsconfig`

3ファイル構成:

- `base.json`: 既存 `tsconfig.base.json` を移管。`strict: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`, `noUnusedLocals: true` などを厳格化。
- `lib.json`: `composite: true`, declaration emit、ライブラリ用。
- `app.json`: `jsx: react-jsx`, `moduleResolution: bundler`、Vite 前提。

各パッケージの `tsconfig.json` は `"extends": "@org/config-tsconfig/lib.json"` 等で参照。

### 4.3 `packages/config-tailwind`

`preset.ts` で共通カラー、フォント、スペーシング、プラグインを定義。

`apps/*` と `packages/ui` の `tailwind.config.ts` で:

```ts
import preset from '@org/config-tailwind/preset';
export default { presets: [preset], content: [...] };
```

### 4.4 `packages/config-vitest`

3 preset 構成:

- `node.ts`: 純ロジック用（`packages/game-core` 等）
- `react.ts`: jsdom + testing-library setup（`packages/ui`, `apps/*`）
- `pixi.ts`: canvas mock を含む（`packages/game-core` のレンダリング層）

各パッケージの `vitest.config.ts`:

```ts
import { mergeConfig, defineConfig } from 'vitest/config';
import base from '@org/config-vitest/react';
export default mergeConfig(base, defineConfig({ /* override */ }));
```

### 4.5 コメント規約

コメントは日本語で記述。Biome のルールでは強制不可なため、`CLAUDE.md` と `memory/conventions.md` に明記し、レビューと自己レビューで担保する。

## 5. Claude Hooks / コマンド / 失敗記録

### 5.1 PostToolUse による自動フォーマット

`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/biome-format.mjs"
          }
        ]
      }
    ]
  }
}
```

`biome-format.mjs` は stdin で受け取った hook payload から `tool_input.file_path` を抽出し、対象ファイルが `.ts/.tsx/.js/.jsx/.json/.jsonc` のいずれかであれば `pnpm exec biome format --write <path>` を実行する。失敗しても non-blocking（exit 0）で返す。

### 5.2 PreToolUse による commit ゲート

`git commit` 系の Bash 実行直前に `nx affected -t lint test` をサブエージェントで起動し、結果を確認するゲートを設置する。失敗時は commit をブロック。

### 5.3 スラッシュコマンド

| コマンド | 内容 |
|---------|------|
| `.claude/commands/lint.md` | サブエージェントで `pnpm nx affected -t lint` を実行し結果を要約 |
| `.claude/commands/test.md` | 同 `-t test` |
| `.claude/commands/format.md` | `pnpm exec biome format --write .` 全体実行 |

各コマンドは `Agent` ツールで `general-purpose` サブエージェントを起動し、メイン会話のコンテキストを汚さない。

### 5.4 失敗時の自動記録

タスクが失敗・誤りだった場合に次を自動実行する運用ルール:

1. 失敗の原因を簡潔に分析
2. プロジェクト固有の失敗 → `memory/YYYY-MM-DD-<topic>.md`
3. 汎用的な失敗パターン → `rules/<rule-name>.md`
4. `memory/` に同種の失敗が **2回以上** 記録された場合、`rules/` に昇格させ、`CLAUDE.md` から参照を追加

`memory/README.md` と `rules/README.md` に運用方針を記述し、`CLAUDE.md` から両ディレクトリを参照させる。

### 5.5 CLAUDE.md への追記

既存のNxセクションは保持し、以下のコード規約セクションを追加する:

- `any` 禁止（Biome が error で検出）
- if 文の制御ブロックは1行でも `{}` で囲う（Biome が error で検出）
- コメントは日本語
- 失敗時の自動記録ルール（上記）

## 6. テスト戦略

| レイヤ | 場所 | ツール |
|------|------|--------|
| ユニット | `packages/*/src/**/*.test.ts` | vitest (node) |
| ユニット (React) | `packages/ui/src/**/*.test.tsx` | vitest (jsdom) + testing-library |
| コンポーネント | `apps/sample-game/src/**/*.test.tsx` | vitest (jsdom) |
| E2E | `apps/sample-game/e2e/*.spec.ts` | Playwright |

Nx の inferred-tasks により各プロジェクトに `test` / `e2e` が自動付与され、`pnpm nx affected -t test e2e` で差分のみ実行する。

### TDD 運用

`superpowers:test-driven-development` スキルに従い、実装前に必ず失敗するテストを先に書く。Red → Green → Refactor を1単位として進める。

## 7. CI

`.github/workflows/ci.yml` を新設:

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - uses: nrwl/nx-set-shas@v4
      - run: pnpm exec biome ci .
      - run: pnpm nx affected -t typecheck test
      - run: pnpm nx affected -t build
      - run: pnpm exec playwright install --with-deps
      - run: pnpm nx affected -t e2e
```

Nx Cloud は初期は無効。後日必要に応じて有効化する。

## 8. 初期サンプル実装（`apps/sample-game`）

すべての主要ライブラリの動線を初期から検証するための最小ゲーム:

- React 19 + Vite で起動
- `<GameCanvas />`（game-core が提供）で Pixi の Application をマウント
- 1つの操作可能なスプライト（クリック/タップで反応）
- 効果音1つ（`packages/audio` 経由、use-sound）
- Tailwind の HUD（スコア表示）
- Zustand の store でスコア状態管理
- Zod でローカルストレージのセーブデータをバリデート
- vitest: スコアロジックのテスト3本
- Playwright: 「起動 → スプライト操作 → スコア増加」E2E 1本

## 9. 移行手順の概要（実装プランで詳細化）

1. Prettier / `.prettierrc` / `.prettierignore` を撤去
2. Biome を導入、`packages/config-biome` を作成
3. `pnpm-workspace.yaml` に `apps/*` を追加し catalog を定義
4. Nxプラグイン（`@nx/react`, `@nx/vite`, `@nx/playwright`）を追加
5. `packages/config-{tsconfig,tailwind,vitest}` を作成
6. `packages/{ui,game-core,audio}` を順にスキャフォールド
7. `apps/sample-game` をスキャフォールドし最小ゲームを実装
8. `.claude/settings.json` にHooks、`.claude/commands/` にスラッシュコマンドを設定
9. `memory/` `rules/` のREADMEを整備し、`CLAUDE.md` を更新
10. `.github/workflows/ci.yml` を作成
11. 全体で `pnpm nx run-many -t typecheck lint test build` がグリーンになることを確認

## 10. 成功基準

- `pnpm nx graph` で apps/packages の依存関係が正しく可視化される
- `pnpm nx run-many -t typecheck lint test build e2e` がローカルで全てグリーン
- `apps/sample-game` をローカル起動し、スプライト操作 → スコア増加 → 効果音再生が動作
- Claude が `Edit/Write` した直後に対象ファイルが Biome でフォーマットされる
- `/lint` `/test` スラッシュコマンドがサブエージェント経由で実行される
- `pnpm-workspace.yaml` の catalog 1ヶ所のバージョン更新が、全パッケージに反映される

## 11. 残課題（このスペック外）

- Nx Cloud 有効化のタイミングと運用
- 本番ゲームコンテンツのアセットパイプライン（画像/音声の最適化、CDN）
- Web Workers / WebAssembly 利用のガイドライン
- リリース戦略（`nx release` の採用可否）
- マルチプレイヤー対応時の構成（バックエンド配置）
