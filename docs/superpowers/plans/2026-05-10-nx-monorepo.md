# Nxモノレポ ゲーム開発基盤 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の最小Nxワークスペースを、複数ゲーム + 共有ライブラリを開発可能なモノレポに拡張する。Biome / pnpm Catalogs / TDD / Claude Hooks 自動フォーマット / サブエージェント駆動 lint/test を初期から有効化する。

**Architecture:** apps/sample-game が packages/{ui, game-core, audio} を消費し、それらが packages/config-{biome, tsconfig, tailwind, vitest} を継承する一方向依存。Nxの inferred-tasks (`@nx/js`, `@nx/react`, `@nx/vite`, `@nx/playwright`) で `build/test/typecheck/e2e` を自動付与。

**Tech Stack:** pnpm workspaces (Catalogs), Nx 22.7.0, TypeScript 5.9, Biome 2.x, Vite 7.x, React 19, Pixi.js 8.x, @pixi/react 8.x, Zustand 5.x, Zod 4.x, howler.js + use-sound, Tailwind CSS v4, vitest 3.x, Playwright 1.5x。

**前提:** 既に `node_modules` 配下に `nx@22.7.0` と `@nx/js` がインストール済み。Node は `.nvmrc` (v26.1.0) を `direnv` で自動切替する想定。

---

## ファイル構成

実装後の状態:

```
game-workspace/
├── apps/
│   └── sample-game/
│       ├── e2e/sample-game.spec.ts
│       ├── src/{App.tsx, main.tsx, game.test.tsx, styles.css}
│       ├── index.html
│       ├── package.json
│       ├── playwright.config.ts
│       ├── tailwind.config.ts (v4はCSS @theme で代替)
│       ├── tsconfig.app.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── packages/
│   ├── audio/
│   │   ├── src/{index.ts, useSound.ts, useSound.test.tsx}
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   ├── config-biome/
│   │   ├── biome.json
│   │   └── package.json
│   ├── config-tailwind/
│   │   ├── src/theme.css
│   │   └── package.json
│   ├── config-tsconfig/
│   │   ├── base.json
│   │   ├── lib.json
│   │   ├── app.json
│   │   └── package.json
│   ├── config-vitest/
│   │   ├── src/{node.ts, react.ts, pixi.ts, setup.ts}
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── game-core/
│   │   ├── src/{index.ts, score.ts, score.test.ts, save.ts, save.test.ts, GameCanvas.tsx}
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── ui/
│       ├── src/{index.ts, ScoreHud.tsx, ScoreHud.test.tsx, styles.css}
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── memory/README.md
├── rules/README.md
├── .claude/
│   ├── settings.json (修正)
│   ├── commands/{lint.md, test.md, format.md}
│   └── hooks/{biome-format.mjs, pre-commit-gate.mjs}
├── .github/workflows/ci.yml
├── biome.json (ルートからconfig-biome継承)
├── pnpm-workspace.yaml (apps/* + catalog 追加)
├── nx.json (プラグイン3つ追記)
├── package.json (devDep更新)
├── tsconfig.base.json (削除→config-tsconfigへ)
├── tsconfig.json (references追加)
└── CLAUDE.md (コード規約追記)
```

各ファイルの責務:
- `packages/config-*`: 設定単一ソース。継承先で薄く参照されるだけ。
- `packages/game-core`: Pixiレンダリング、Zustandスコア、Zodセーブの3責務。他packagesへ依存なし。
- `packages/audio`: howler/use-sound の薄いReactラッパー。
- `packages/ui`: Tailwindで描画する純粋UI（HUD等）。audioに依存可。
- `apps/sample-game`: 上記を組み合わせる薄いオーケストレーター。

---

## Phase 1: 設定基盤

### Task 1: Prettier撤去 + Biome導入 + config-biome パッケージ作成

**Files:**
- Delete: `.prettierrc`, `.prettierignore`
- Create: `packages/config-biome/biome.json`, `packages/config-biome/package.json`
- Create: `biome.json` (ルート、config-biome を extend)
- Modify: `package.json:1-15` (devDep更新)

- [ ] **Step 1: Prettier 関連ファイルを削除**

```bash
rm /Users/ikomiki/workspace/game-workspace/.prettierrc \
   /Users/ikomiki/workspace/game-workspace/.prettierignore
```

- [ ] **Step 2: `packages/config-biome/package.json` を作成**

```json
{
  "name": "@org/config-biome",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./biome.json": "./biome.json"
  }
}
```

- [ ] **Step 3: `packages/config-biome/biome.json` を作成**

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

- [ ] **Step 4: ルート `biome.json` を作成（config-biome を extend）**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "extends": ["@org/config-biome/biome.json"]
}
```

- [ ] **Step 5: ルート `package.json` の devDependencies を更新**

`prettier` を削除し `@biomejs/biome` を追加。catalog 参照は次タスクで設定するので一旦バージョンは固定値:

```json
{
  "name": "@org/source",
  "version": "0.0.0",
  "license": "MIT",
  "scripts": {},
  "private": true,
  "dependencies": {},
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "@nx/js": "22.7.0",
    "@swc-node/register": "1.11.1",
    "@swc/core": "1.15.8",
    "@swc/helpers": "0.5.18",
    "nx": "22.7.0",
    "tslib": "^2.3.0",
    "typescript": "~5.9.2"
  }
}
```

- [ ] **Step 6: `pnpm install` を実行**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm install
```

期待: `prettier` が外れ `@biomejs/biome` がインストールされる。

- [ ] **Step 7: Biome の動作確認**

```bash
pnpm exec biome format --write .
```

期待: エラーなく完了。

- [ ] **Step 8: コミット**

```bash
git add -A && git commit -m "feat: Biome導入とPrettier撤去、config-biome パッケージ作成

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: pnpm-workspace.yaml に apps/* と catalog を定義

**Files:**
- Modify: `pnpm-workspace.yaml` (全面置換)

- [ ] **Step 1: `pnpm-workspace.yaml` を更新**

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
  '@testing-library/user-event': ^14.0.0
  jsdom: ^26.0.0
  '@playwright/test': ^1.50.0

  # Linter/Formatter
  '@biomejs/biome': ^2.0.0

  # TypeScript
  typescript: ~5.9.2
```

- [ ] **Step 2: ルート `package.json` で catalog 参照に切替**

```json
{
  "name": "@org/source",
  "version": "0.0.0",
  "license": "MIT",
  "scripts": {},
  "private": true,
  "dependencies": {},
  "devDependencies": {
    "@biomejs/biome": "catalog:",
    "@nx/js": "22.7.0",
    "@swc-node/register": "1.11.1",
    "@swc/core": "1.15.8",
    "@swc/helpers": "0.5.18",
    "nx": "22.7.0",
    "tslib": "^2.3.0",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 3: `apps/` ディレクトリを作成**

```bash
mkdir -p /Users/ikomiki/workspace/game-workspace/apps && \
  touch /Users/ikomiki/workspace/game-workspace/apps/.gitkeep
```

- [ ] **Step 4: `pnpm install` で catalog 解決を確認**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm install
```

期待: 警告なくインストール完了。

- [ ] **Step 5: コミット**

```bash
git add -A && git commit -m "feat: pnpm catalog定義とapps/ディレクトリ追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Nxプラグイン追加（@nx/react, @nx/vite, @nx/playwright）

**Files:**
- Modify: `package.json` (devDependencies追加)
- Modify: `nx.json` (plugins追記)

- [ ] **Step 1: 必要プラグインをインストール**

```bash
cd /Users/ikomiki/workspace/game-workspace && \
  pnpm add -Dw @nx/react@22.7.0 @nx/vite@22.7.0 @nx/playwright@22.7.0
```

期待: 3つのプラグインが devDependencies に追加される。

- [ ] **Step 2: `nx.json` の `plugins` 配列を拡張**

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": ["default"],
    "sharedGlobals": []
  },
  "plugins": [
    {
      "plugin": "@nx/js/typescript",
      "options": {
        "typecheck": { "targetName": "typecheck" },
        "build": {
          "targetName": "build",
          "configName": "tsconfig.lib.json",
          "buildDepsName": "build-deps",
          "watchDepsName": "watch-deps"
        }
      }
    },
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build",
        "testTargetName": "test",
        "serveTargetName": "serve",
        "previewTargetName": "preview",
        "typecheckTargetName": "typecheck"
      }
    },
    {
      "plugin": "@nx/playwright/plugin",
      "options": { "targetName": "e2e" }
    }
  ],
  "analytics": true
}
```

注: `@nx/react` は generator 用途なので plugins には不要。

- [ ] **Step 3: `pnpm nx show projects` で構成確認**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm nx show projects
```

期待: エラーなし、現時点ではプロジェクトなし。

- [ ] **Step 4: コミット**

```bash
git add -A && git commit -m "feat: Nxプラグイン追加 (react/vite/playwright)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: packages/config-tsconfig 作成

**Files:**
- Delete: `tsconfig.base.json` (内容を config-tsconfig へ移管)
- Create: `packages/config-tsconfig/{package.json, base.json, lib.json, app.json}`
- Modify: `tsconfig.json` (references空のまま、後で生成済みプロジェクトが追記)

- [ ] **Step 1: `packages/config-tsconfig/package.json` を作成**

```json
{
  "name": "@org/config-tsconfig",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./base.json": "./base.json",
    "./lib.json": "./lib.json",
    "./app.json": "./app.json"
  }
}
```

- [ ] **Step 2: `packages/config-tsconfig/base.json` を作成**

```json
{
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": false,
    "importHelpers": true,
    "isolatedModules": true,
    "lib": ["es2022", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmitOnError": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "exactOptionalPropertyTypes": true,
    "target": "es2022",
    "verbatimModuleSyntax": false
  }
}
```

- [ ] **Step 3: `packages/config-tsconfig/lib.json` を作成**

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "emitDeclarationOnly": true
  }
}
```

- [ ] **Step 4: `packages/config-tsconfig/app.json` を作成**

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "noEmit": true
  }
}
```

- [ ] **Step 5: 既存 `tsconfig.base.json` を削除**

```bash
rm /Users/ikomiki/workspace/game-workspace/tsconfig.base.json
```

- [ ] **Step 6: ルート `tsconfig.json` を更新（references は空のまま）**

```json
{
  "extends": "@org/config-tsconfig/base.json",
  "compileOnSave": false,
  "files": [],
  "references": []
}
```

- [ ] **Step 7: `pnpm install` で workspace パッケージを認識させる**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm install
```

- [ ] **Step 8: 型チェックがエラーなく動くことを確認**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm exec tsc --noEmit
```

期待: エラーなし（プロジェクトがまだ無いため何も型チェックされない）。

- [ ] **Step 9: コミット**

```bash
git add -A && git commit -m "feat: packages/config-tsconfig 作成、tsconfig.base.json 移管

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: packages/config-vitest 作成

**Files:**
- Create: `packages/config-vitest/{package.json, tsconfig.json, src/{node.ts, react.ts, pixi.ts, setup.ts}}`

- [ ] **Step 1: `packages/config-vitest/package.json` を作成**

```json
{
  "name": "@org/config-vitest",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./node": "./src/node.ts",
    "./react": "./src/react.ts",
    "./pixi": "./src/pixi.ts",
    "./setup": "./src/setup.ts"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "catalog:",
    "@testing-library/react": "catalog:",
    "jsdom": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: `packages/config-vitest/tsconfig.json` を作成**

```json
{
  "extends": "@org/config-tsconfig/base.json",
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: `packages/config-vitest/src/node.ts` を作成**

```ts
import { defineConfig } from 'vitest/config';

// Node環境向けのvitest基本設定（純ロジック用）
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: `packages/config-vitest/src/setup.ts` を作成**

```ts
// jsdom 環境用のテストセットアップ
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: `packages/config-vitest/src/react.ts` を作成**

```ts
import { defineConfig } from 'vitest/config';

// React (jsdom + testing-library) 向けのvitest基本設定
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['@org/config-vitest/setup'],
  },
});
```

- [ ] **Step 6: `packages/config-vitest/src/pixi.ts` を作成**

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import react from './react';

// Pixi利用テスト向け: jsdomにcanvasモックを足したい場合の拡張ポイント。
// 実際のレンダリングは別途e2eで担保し、ここは型/ロジック層のテストに留める。
export default mergeConfig(
  react,
  defineConfig({
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      // canvas を使うテストは server.deps.inline で .mjs 解決問題を避ける
      server: { deps: { inline: ['pixi.js'] } },
    },
  }),
);
```

- [ ] **Step 7: `pnpm install` を実行**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm install
```

- [ ] **Step 8: コミット**

```bash
git add -A && git commit -m "feat: packages/config-vitest 作成 (node/react/pixi 3 preset)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: packages/config-tailwind 作成

**Files:**
- Create: `packages/config-tailwind/{package.json, src/theme.css}`

注: Tailwind v4 は CSS-first なので JS preset ではなく `@theme` ブロックを `.css` で配布する。

- [ ] **Step 1: `packages/config-tailwind/package.json` を作成**

```json
{
  "name": "@org/config-tailwind",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./theme.css": "./src/theme.css"
  }
}
```

- [ ] **Step 2: `packages/config-tailwind/src/theme.css` を作成**

```css
/* 共通テーマ定義: 各app/lib から `@import '@org/config-tailwind/theme.css';` で読み込む */
@theme {
  --color-game-bg: #0b0d12;
  --color-game-fg: #e6e8ef;
  --color-game-accent: #4cc9f0;
  --font-display: 'Inter', 'Hiragino Sans', sans-serif;
}
```

- [ ] **Step 3: `pnpm install` を実行**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm install
```

- [ ] **Step 4: コミット**

```bash
git add -A && git commit -m "feat: packages/config-tailwind 作成 (Tailwind v4 CSS-first)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: 共有ライブラリ

### Task 7: packages/game-core スキャフォールドと Score store (TDD)

**Files:**
- Create: `packages/game-core/{package.json, tsconfig.json, vitest.config.ts, biome.json, src/{index.ts, score.ts, score.test.ts}}`

- [ ] **Step 1: ディレクトリと骨組みファイルを作成**

`packages/game-core/package.json`:

```json
{
  "name": "@org/game-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "pixi.js": "catalog:",
    "@pixi/react": "catalog:",
    "react": "catalog:",
    "zod": "catalog:",
    "zustand": "catalog:"
  },
  "devDependencies": {
    "@org/config-biome": "workspace:*",
    "@org/config-tsconfig": "workspace:*",
    "@org/config-vitest": "workspace:*",
    "@types/react": "catalog:",
    "vitest": "catalog:"
  }
}
```

`packages/game-core/tsconfig.json`:

```json
{
  "extends": "@org/config-tsconfig/lib.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx"]
}
```

`packages/game-core/vitest.config.ts`:

```ts
import base from '@org/config-vitest/pixi';
export default base;
```

`packages/game-core/biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "extends": ["@org/config-biome/biome.json"]
}
```

- [ ] **Step 2: `pnpm install` で依存解決**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm install
```

- [ ] **Step 3: 失敗するテスト `src/score.test.ts` を書く**

```ts
import { describe, it, expect } from 'vitest';
import { createScoreStore } from './score';

describe('createScoreStore', () => {
  it('初期スコアは0', () => {
    const store = createScoreStore();
    expect(store.getState().score).toBe(0);
  });

  it('increment で +1 される', () => {
    const store = createScoreStore();
    store.getState().increment();
    expect(store.getState().score).toBe(1);
  });

  it('reset で 0 に戻る', () => {
    const store = createScoreStore();
    store.getState().increment();
    store.getState().increment();
    store.getState().reset();
    expect(store.getState().score).toBe(0);
  });
});
```

- [ ] **Step 4: テストが失敗することを確認**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm nx test game-core
```

期待: FAIL with "Failed to resolve import './score'"。

- [ ] **Step 5: 最小実装 `src/score.ts` を書く**

```ts
import { createStore } from 'zustand/vanilla';

// スコア状態と操作を提供するZustand store
export interface ScoreState {
  score: number;
  increment: () => void;
  reset: () => void;
}

export const createScoreStore = () =>
  createStore<ScoreState>((set) => ({
    score: 0,
    increment: () => {
      set((state) => ({ score: state.score + 1 }));
    },
    reset: () => {
      set({ score: 0 });
    },
  }));
```

- [ ] **Step 6: `src/index.ts` で再エクスポート**

```ts
export { createScoreStore } from './score';
export type { ScoreState } from './score';
```

- [ ] **Step 7: テストが通ることを確認**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm nx test game-core
```

期待: PASS 3 tests。

- [ ] **Step 8: typecheck 実行**

```bash
pnpm nx typecheck game-core
```

期待: PASS。

- [ ] **Step 9: コミット**

```bash
git add -A && git commit -m "feat(game-core): Zustand Score store を実装

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: packages/game-core にZodセーブデータバリデーター追加 (TDD)

**Files:**
- Create: `packages/game-core/src/{save.ts, save.test.ts}`
- Modify: `packages/game-core/src/index.ts`

- [ ] **Step 1: 失敗するテスト `src/save.test.ts` を書く**

```ts
import { describe, it, expect } from 'vitest';
import { parseSaveData, type SaveData } from './save';

describe('parseSaveData', () => {
  it('有効なデータをパースできる', () => {
    const input = { highScore: 42, version: 1 };
    const result = parseSaveData(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const data: SaveData = result.data;
      expect(data.highScore).toBe(42);
    }
  });

  it('highScore が負数の場合は失敗する', () => {
    const input = { highScore: -1, version: 1 };
    const result = parseSaveData(input);
    expect(result.success).toBe(false);
  });

  it('version 不一致の場合は失敗する', () => {
    const input = { highScore: 0, version: 2 };
    const result = parseSaveData(input);
    expect(result.success).toBe(false);
  });

  it('未知のフィールドは無視される', () => {
    const input = { highScore: 1, version: 1, extra: 'ignored' };
    const result = parseSaveData(input);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
pnpm nx test game-core
```

期待: FAIL with "Failed to resolve import './save'"。

- [ ] **Step 3: 実装 `src/save.ts` を書く**

```ts
import { z } from 'zod';

// セーブデータスキーマ。version でマイグレーション境界を担保。
const saveDataSchema = z.object({
  highScore: z.number().int().nonnegative(),
  version: z.literal(1),
});

export type SaveData = z.infer<typeof saveDataSchema>;

export const parseSaveData = (input: unknown) => saveDataSchema.safeParse(input);
```

- [ ] **Step 4: `src/index.ts` を更新**

```ts
export { createScoreStore } from './score';
export type { ScoreState } from './score';
export { parseSaveData } from './save';
export type { SaveData } from './save';
```

- [ ] **Step 5: テスト通過確認**

```bash
pnpm nx test game-core
```

期待: PASS 7 tests。

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat(game-core): Zodセーブデータバリデーター追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: packages/game-core に GameCanvas コンポーネント追加

**Files:**
- Create: `packages/game-core/src/GameCanvas.tsx`
- Modify: `packages/game-core/src/index.ts`

注: `@pixi/react` v8 は React 19 と Pixi 8 のブリッジ。レンダリング統合の最小骨格を用意する。レンダリング自体のテストは Playwright 側で担保するため、ここではコンポーネントが props を正しく描画情報として展開することを軽く検証する。

- [ ] **Step 1: `src/GameCanvas.tsx` を作成**

```tsx
import { Application, extend } from '@pixi/react';
import { Container, Graphics, Sprite } from 'pixi.js';
import { type ReactNode } from 'react';

// @pixi/react にPixi要素を登録（v8の必須API）
extend({ Container, Graphics, Sprite });

interface GameCanvasProps {
  width: number;
  height: number;
  children?: ReactNode;
}

// Pixi.js Applicationをマウントする最小コンポーネント。
// アプリ側でこの中にPixi要素を子として配置する。
export const GameCanvas = ({ width, height, children }: GameCanvasProps) => (
  <Application width={width} height={height} background="#0b0d12">
    {children}
  </Application>
);
```

- [ ] **Step 2: `src/index.ts` を更新**

```ts
export { createScoreStore } from './score';
export type { ScoreState } from './score';
export { parseSaveData } from './save';
export type { SaveData } from './save';
export { GameCanvas } from './GameCanvas';
```

- [ ] **Step 3: typecheck 実行**

```bash
pnpm nx typecheck game-core
```

期待: PASS。

- [ ] **Step 4: lint 実行**

```bash
pnpm exec biome check packages/game-core
```

期待: エラーなし。

- [ ] **Step 5: コミット**

```bash
git add -A && git commit -m "feat(game-core): GameCanvas コンポーネント追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: packages/audio スキャフォールドと useSound ラッパー (TDD)

**Files:**
- Create: `packages/audio/{package.json, tsconfig.json, vitest.config.ts, biome.json, src/{index.ts, useSound.ts, useSound.test.tsx}}`

- [ ] **Step 1: パッケージ骨格を作成**

`packages/audio/package.json`:

```json
{
  "name": "@org/audio",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "howler": "catalog:",
    "react": "catalog:",
    "use-sound": "catalog:"
  },
  "devDependencies": {
    "@org/config-biome": "workspace:*",
    "@org/config-tsconfig": "workspace:*",
    "@org/config-vitest": "workspace:*",
    "@testing-library/react": "catalog:",
    "@types/howler": "catalog:",
    "@types/react": "catalog:",
    "vitest": "catalog:"
  }
}
```

`packages/audio/tsconfig.json`:

```json
{
  "extends": "@org/config-tsconfig/lib.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx"]
}
```

`packages/audio/vitest.config.ts`:

```ts
import base from '@org/config-vitest/react';
export default base;
```

`packages/audio/biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "extends": ["@org/config-biome/biome.json"]
}
```

- [ ] **Step 2: `pnpm install`**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm install
```

- [ ] **Step 3: 失敗するテスト `src/useSound.test.tsx` を書く**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameSound } from './useSound';

vi.mock('use-sound', () => ({
  default: () => [vi.fn(), { stop: vi.fn() }],
}));

describe('useGameSound', () => {
  it('play 関数を返す', () => {
    const { result } = renderHook(() => useGameSound('/se/click.mp3'));
    expect(typeof result.current.play).toBe('function');
  });

  it('stop 関数を返す', () => {
    const { result } = renderHook(() => useGameSound('/se/click.mp3'));
    expect(typeof result.current.stop).toBe('function');
  });
});
```

- [ ] **Step 4: テスト失敗を確認**

```bash
pnpm nx test audio
```

期待: FAIL with "Failed to resolve import './useSound'"。

- [ ] **Step 5: 実装 `src/useSound.ts` を書く**

```ts
import useSoundLib from 'use-sound';

interface GameSound {
  play: () => void;
  stop: () => void;
}

// use-sound の薄いラッパー。プロジェクト内で SE/BGM 用途のフック呼び出しを統一する。
export const useGameSound = (src: string, volume = 1): GameSound => {
  const [play, { stop }] = useSoundLib(src, { volume });
  return {
    play: () => {
      play();
    },
    stop: () => {
      stop();
    },
  };
};
```

- [ ] **Step 6: `src/index.ts` を作成**

```ts
export { useGameSound } from './useSound';
```

- [ ] **Step 7: テスト通過確認**

```bash
pnpm nx test audio
```

期待: PASS 2 tests。

- [ ] **Step 8: コミット**

```bash
git add -A && git commit -m "feat(audio): useGameSound フック実装

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: packages/ui スキャフォールドと ScoreHud コンポーネント (TDD)

**Files:**
- Create: `packages/ui/{package.json, tsconfig.json, vitest.config.ts, biome.json, src/{index.ts, ScoreHud.tsx, ScoreHud.test.tsx, styles.css}}`

- [ ] **Step 1: パッケージ骨格を作成**

`packages/ui/package.json`:

```json
{
  "name": "@org/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./styles.css": "./src/styles.css"
  },
  "dependencies": {
    "@org/audio": "workspace:*",
    "react": "catalog:"
  },
  "devDependencies": {
    "@org/config-biome": "workspace:*",
    "@org/config-tailwind": "workspace:*",
    "@org/config-tsconfig": "workspace:*",
    "@org/config-vitest": "workspace:*",
    "@testing-library/react": "catalog:",
    "@testing-library/jest-dom": "catalog:",
    "@types/react": "catalog:",
    "vitest": "catalog:"
  }
}
```

`packages/ui/tsconfig.json`:

```json
{
  "extends": "@org/config-tsconfig/lib.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx"]
}
```

`packages/ui/vitest.config.ts`:

```ts
import base from '@org/config-vitest/react';
export default base;
```

`packages/ui/biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "extends": ["@org/config-biome/biome.json"]
}
```

`packages/ui/src/styles.css`:

```css
@import 'tailwindcss';
@import '@org/config-tailwind/theme.css';
```

- [ ] **Step 2: `pnpm install`**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm install
```

- [ ] **Step 3: 失敗するテスト `src/ScoreHud.test.tsx` を書く**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreHud } from './ScoreHud';

describe('ScoreHud', () => {
  it('スコアを表示する', () => {
    render(<ScoreHud score={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('ラベル "Score" を表示する', () => {
    render(<ScoreHud score={0} />);
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('aria-label でアクセシブル', () => {
    render(<ScoreHud score={7} />);
    expect(screen.getByRole('status', { name: /score/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: テスト失敗を確認**

```bash
pnpm nx test ui
```

期待: FAIL with "Failed to resolve import './ScoreHud'"。

- [ ] **Step 5: 実装 `src/ScoreHud.tsx` を書く**

```tsx
interface ScoreHudProps {
  score: number;
}

// 画面上部に固定表示するスコアHUD
export const ScoreHud = ({ score }: ScoreHudProps) => (
  <div
    role="status"
    aria-label="Score"
    className="absolute top-4 left-4 rounded bg-game-bg/80 px-4 py-2 font-display text-game-fg"
  >
    <div className="text-xs uppercase tracking-wider">Score</div>
    <div className="text-2xl text-game-accent">{score}</div>
  </div>
);
```

- [ ] **Step 6: `src/index.ts` を作成**

```ts
export { ScoreHud } from './ScoreHud';
```

- [ ] **Step 7: テスト通過確認**

```bash
pnpm nx test ui
```

期待: PASS 3 tests。

- [ ] **Step 8: コミット**

```bash
git add -A && git commit -m "feat(ui): ScoreHud コンポーネント実装

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: アプリ

### Task 12: apps/sample-game スキャフォールド

**Files:**
- Create: `apps/sample-game/{package.json, tsconfig.json, tsconfig.app.json, vite.config.ts, index.html, src/{main.tsx, App.tsx, styles.css}, biome.json, public/.gitkeep}`

- [ ] **Step 1: ディレクトリ作成と骨格ファイル**

`apps/sample-game/package.json`:

```json
{
  "name": "@org/sample-game",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@org/audio": "workspace:*",
    "@org/game-core": "workspace:*",
    "@org/ui": "workspace:*",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@org/config-biome": "workspace:*",
    "@org/config-tailwind": "workspace:*",
    "@org/config-tsconfig": "workspace:*",
    "@org/config-vitest": "workspace:*",
    "@testing-library/react": "catalog:",
    "@testing-library/user-event": "catalog:",
    "@tailwindcss/vite": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "tailwindcss": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

`apps/sample-game/tsconfig.json`:

```json
{
  "extends": "@org/config-tsconfig/app.json",
  "include": ["src/**/*"]
}
```

`apps/sample-game/tsconfig.app.json`:

```json
{
  "extends": "@org/config-tsconfig/app.json",
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx", "e2e/**"]
}
```

`apps/sample-game/biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "extends": ["@org/config-biome/biome.json"]
}
```

`apps/sample-game/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import baseTest from '@org/config-vitest/react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: baseTest.test,
});
```

`apps/sample-game/index.html`:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sample Game</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/sample-game/src/styles.css`:

```css
@import 'tailwindcss';
@import '@org/config-tailwind/theme.css';

html, body, #root {
  height: 100%;
  margin: 0;
  background: var(--color-game-bg);
  color: var(--color-game-fg);
}
```

`apps/sample-game/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element not found');
}
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`apps/sample-game/src/App.tsx`（最小プレースホルダ、次タスクで本実装）:

```tsx
export const App = () => <div data-testid="app">loading...</div>;
```

`apps/sample-game/public/.gitkeep`: 空ファイル

- [ ] **Step 2: `pnpm install`**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm install
```

- [ ] **Step 3: dev サーバ起動確認 (バックグラウンド)**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm nx serve sample-game
```

期待: 5173 でサーバ起動、ブラウザで `loading...` 表示。確認したら停止。

- [ ] **Step 4: typecheck**

```bash
pnpm nx typecheck sample-game
```

期待: PASS。

- [ ] **Step 5: コミット**

```bash
git add -A && git commit -m "feat(sample-game): アプリスキャフォールド (Vite + React + Tailwind)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: apps/sample-game に最小ゲームを実装 (TDD)

**Files:**
- Create: `apps/sample-game/src/{game.test.tsx, useSampleGame.ts}`
- Modify: `apps/sample-game/src/App.tsx`
- Add asset: `apps/sample-game/public/se/click.mp3` (空のスタブで可)

- [ ] **Step 1: 効果音スタブを置く**

```bash
mkdir -p /Users/ikomiki/workspace/game-workspace/apps/sample-game/public/se && \
  : > /Users/ikomiki/workspace/game-workspace/apps/sample-game/public/se/click.mp3
```

注: 中身は空でよい。Playwrightテストでは効果音再生の検証はしない（howlerは音を鳴らせなくてもエラーにはしない設定にする）。

- [ ] **Step 2: 失敗するテスト `src/game.test.tsx` を書く**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

vi.mock('use-sound', () => ({
  default: () => [vi.fn(), { stop: vi.fn() }],
}));

vi.mock('@pixi/react', () => ({
  Application: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="pixi-app">{children}</div>
  ),
  extend: () => undefined,
}));

describe('App (sample-game)', () => {
  it('初期スコア 0 を表示する', () => {
    render(<App />);
    expect(screen.getByRole('status', { name: /score/i })).toHaveTextContent('0');
  });

  it('スプライトボタンをクリックするとスコアが +1 される', async () => {
    const user = userEvent.setup();
    render(<App />);
    const sprite = screen.getByRole('button', { name: /tap/i });
    await user.click(sprite);
    expect(screen.getByRole('status', { name: /score/i })).toHaveTextContent('1');
  });
});
```

- [ ] **Step 3: テスト失敗を確認**

```bash
pnpm nx test sample-game
```

期待: FAIL（App はまだスコアもボタンも持っていない）。

- [ ] **Step 4: ストアを React にバインドするフック `src/useSampleGame.ts` を作成**

```ts
import { useSyncExternalStore, useRef } from 'react';
import { createScoreStore } from '@org/game-core';

// アプリ内で1つの ScoreStore インスタンスをぶら下げる薄いフック
export const useSampleGame = () => {
  const storeRef = useRef<ReturnType<typeof createScoreStore> | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createScoreStore();
  }
  const store = storeRef.current;
  const score = useSyncExternalStore(
    store.subscribe,
    () => store.getState().score,
    () => store.getState().score,
  );
  return {
    score,
    increment: store.getState().increment,
    reset: store.getState().reset,
  };
};
```

- [ ] **Step 5: `src/App.tsx` を本実装に差し替え**

```tsx
import { GameCanvas } from '@org/game-core';
import { ScoreHud } from '@org/ui';
import { useGameSound } from '@org/audio';
import { useSampleGame } from './useSampleGame';

// sample-game のメイン画面: HUD + Pixiキャンバス + タップボタン
export const App = () => {
  const { score, increment } = useSampleGame();
  const { play } = useGameSound('/se/click.mp3', 0.5);

  const onTap = () => {
    play();
    increment();
  };

  return (
    <div className="relative h-screen w-screen">
      <ScoreHud score={score} />
      <div className="absolute inset-0 flex items-center justify-center">
        <GameCanvas width={640} height={480}>
          {/* レンダリング詳細はPixi要素として後で拡張 */}
        </GameCanvas>
      </div>
      <button
        type="button"
        onClick={onTap}
        aria-label="tap"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded bg-game-accent px-8 py-4 text-game-bg"
      >
        TAP
      </button>
    </div>
  );
};
```

- [ ] **Step 6: テスト通過確認**

```bash
pnpm nx test sample-game
```

期待: PASS 2 tests。

- [ ] **Step 7: dev サーバで動作確認**

```bash
pnpm nx serve sample-game
```

期待: TAPボタン押下でスコアが+1されるのをブラウザで確認。確認後停止。

- [ ] **Step 8: コミット**

```bash
git add -A && git commit -m "feat(sample-game): スコア+TAPの最小ゲーム実装

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: apps/sample-game に Playwright E2E テストを追加

**Files:**
- Create: `apps/sample-game/{playwright.config.ts, e2e/sample-game.spec.ts}`
- Modify: `apps/sample-game/package.json` (devDep)

- [ ] **Step 1: `package.json` に Playwright を追加**

```json
{
  "devDependencies": {
    "@playwright/test": "catalog:"
  }
}
```

(他の devDep は維持。Edit で `@playwright/test` を1行追加するだけでよい)

- [ ] **Step 2: `pnpm install` & ブラウザインストール**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm install && \
  pnpm exec playwright install chromium
```

- [ ] **Step 3: `apps/sample-game/playwright.config.ts` を作成**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 4: `apps/sample-game/e2e/sample-game.spec.ts` を作成**

```ts
import { test, expect } from '@playwright/test';

test('TAP するとスコアが増える', async ({ page }) => {
  await page.goto('/');
  const score = page.getByRole('status', { name: /score/i });
  await expect(score).toContainText('0');
  await page.getByRole('button', { name: /tap/i }).click();
  await expect(score).toContainText('1');
});
```

- [ ] **Step 5: ビルドしてからE2E実行**

```bash
cd /Users/ikomiki/workspace/game-workspace && \
  pnpm nx build sample-game && \
  pnpm nx e2e sample-game
```

期待: 1 test passed。

- [ ] **Step 6: コミット**

```bash
git add -A && git commit -m "feat(sample-game): Playwright E2Eテスト追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: Claude統合

### Task 15: PostToolUse 自動フォーマット Hook 配線

**Files:**
- Create: `.claude/hooks/biome-format.mjs`
- Modify: `.claude/settings.json`

- [ ] **Step 1: `.claude/hooks/biome-format.mjs` を作成**

```js
#!/usr/bin/env node
// PostToolUse hook: Edit/Write/MultiEdit直後に対象ファイルだけbiome formatする。
// 失敗しても non-blocking（exit 0）。
import { spawnSync } from 'node:child_process';
import { extname } from 'node:path';

const TARGET_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.jsonc']);

const readStdin = () =>
  new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      buf += chunk;
    });
    process.stdin.on('end', () => {
      resolve(buf);
    });
  });

const main = async () => {
  const raw = await readStdin();
  if (!raw.trim()) {
    return;
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  const filePath = payload?.tool_input?.file_path;
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return;
  }
  if (!TARGET_EXTS.has(extname(filePath))) {
    return;
  }
  spawnSync('pnpm', ['exec', 'biome', 'format', '--write', filePath], {
    stdio: 'ignore',
  });
};

main().catch(() => {
  // never block the agent on formatter errors
});
```

- [ ] **Step 2: 実行権限付与**

```bash
chmod +x /Users/ikomiki/workspace/game-workspace/.claude/hooks/biome-format.mjs
```

- [ ] **Step 3: `.claude/settings.json` を更新**

既存の設定を読んでからEditで `hooks` キーを追加（既存があればmergeする）。最終的に以下のキーが含まれていること:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "node .claude/hooks/biome-format.mjs" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: 動作スモークテスト**

```bash
echo '{"tool_input":{"file_path":"/Users/ikomiki/workspace/game-workspace/biome.json"}}' \
  | node /Users/ikomiki/workspace/game-workspace/.claude/hooks/biome-format.mjs && echo OK
```

期待: `OK`。エラーなし。

- [ ] **Step 5: コミット**

```bash
git add -A && git commit -m "feat(claude): PostToolUse 自動Biomeフォーマット hook 追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: スラッシュコマンド lint/test/format

**Files:**
- Create: `.claude/commands/{lint.md, test.md, format.md}`

- [ ] **Step 1: `.claude/commands/lint.md` を作成**

```markdown
---
description: 変更影響範囲のlintをサブエージェントで実行
allowed-tools: Agent
---

`general-purpose` サブエージェントで `pnpm nx affected -t lint` を実行し、
結果を要約して返してください。失敗があれば対象プロジェクトと違反ルールを列挙すること。
コンソールの全文ではなく、必要な情報だけを抜き出してメインに返却します。
```

- [ ] **Step 2: `.claude/commands/test.md` を作成**

```markdown
---
description: 変更影響範囲のtestをサブエージェントで実行
allowed-tools: Agent
---

`general-purpose` サブエージェントで `pnpm nx affected -t test` を実行し、
結果を要約して返してください。失敗があれば対象テスト名と失敗の原因を抜粋すること。
全ログではなく要点だけメインに返却します。
```

- [ ] **Step 3: `.claude/commands/format.md` を作成**

```markdown
---
description: 全体にBiomeフォーマットを適用
allowed-tools: Bash
---

ルートで `pnpm exec biome format --write .` を実行し、
変更されたファイル数を1行で報告してください。
```

- [ ] **Step 4: コミット**

```bash
git add -A && git commit -m "feat(claude): スラッシュコマンド lint/test/format 追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: PreToolUse commit ゲート Hook

**Files:**
- Create: `.claude/hooks/pre-commit-gate.mjs`
- Modify: `.claude/settings.json`

- [ ] **Step 1: `.claude/hooks/pre-commit-gate.mjs` を作成**

```js
#!/usr/bin/env node
// PreToolUse hook: Bash で `git commit` を実行する直前に nx affected -t lint test を走らせる。
// 失敗時は非ゼロ終了で commit をブロックする。
import { spawnSync } from 'node:child_process';

const readStdin = () =>
  new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      buf += chunk;
    });
    process.stdin.on('end', () => {
      resolve(buf);
    });
  });

const main = async () => {
  const raw = await readStdin();
  if (!raw.trim()) {
    return 0;
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return 0;
  }
  const command = payload?.tool_input?.command ?? '';
  // git commit を含み、かつ amend や status などの読み取り系ではないものだけ対象
  if (typeof command !== 'string' || !/\bgit\s+commit\b/.test(command)) {
    return 0;
  }
  if (/--no-verify/.test(command)) {
    return 0;
  }
  const result = spawnSync('pnpm', ['nx', 'affected', '-t', 'lint', 'test'], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.stderr.write('\n[pre-commit-gate] lint/test failed. commit blocked.\n');
    return 2;
  }
  return 0;
};

main()
  .then((code) => {
    process.exit(code);
  })
  .catch(() => {
    // フェイルクローズではなく、フック自体の障害ではcommitを止めない
    process.exit(0);
  });
```

- [ ] **Step 2: 実行権限付与**

```bash
chmod +x /Users/ikomiki/workspace/game-workspace/.claude/hooks/pre-commit-gate.mjs
```

- [ ] **Step 3: `.claude/settings.json` の `PreToolUse` セクションを追加**

既存の `hooks` キーに `PreToolUse` を加える（PostToolUse と並列）:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node .claude/hooks/pre-commit-gate.mjs" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "node .claude/hooks/biome-format.mjs" }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: ゲートが正しく素通りすることをスモークテスト**

```bash
echo '{"tool_input":{"command":"ls -la"}}' \
  | node /Users/ikomiki/workspace/game-workspace/.claude/hooks/pre-commit-gate.mjs ; echo "exit=$?"
```

期待: `exit=0`（git commit を含まないので素通り）。

- [ ] **Step 5: コミット**

```bash
git add -A && git commit -m "feat(claude): PreToolUse git commit ゲート追加

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

注: このコミット自体は新規hookを通すため、上記のゲートが lint/test を起動する。すでにグリーンなはず。失敗したらコミット前に修正。

---

### Task 18: memory/ rules/ READMEs と CLAUDE.md コード規約追記

**Files:**
- Create: `memory/README.md`, `rules/README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: `memory/README.md` を作成**

```markdown
# memory/ — プロジェクト固有の失敗事例

タスクが失敗・誤りだった場合、以下の手順で記録する。

## 書き方

1. ファイル名: `YYYY-MM-DD-<topic>.md`（例: `2026-05-12-tailwind-v4-content-glob.md`）
2. 内容:
   - **What**: 何が起きたか（症状）
   - **Why**: なぜ起きたか（根因）
   - **Fix**: どう直したか
   - **Prevention**: 次回どう防ぐか

## 昇格ルール

同種の失敗が memory/ に **2回以上** 記録されたら `rules/` に昇格させ、
`CLAUDE.md` から参照を追加する。
```

- [ ] **Step 2: `rules/README.md` を作成**

```markdown
# rules/ — 汎用化された失敗回避ルール

`memory/` で2回以上発生した失敗パターンや、汎用的な「やってはいけない」を集約する。

## 書き方

- ファイル名: `<rule-name>.md`（例: `no-implicit-any.md`）
- 内容:
  - **Rule**: 一文で書く禁止/必須事項
  - **Rationale**: なぜ
  - **How to apply**: いつ/どう適用するか
  - **References**: 関連 memory/ エントリへのリンク

`CLAUDE.md` の「コード規約」セクションから本ディレクトリへ参照を貼ること。
```

- [ ] **Step 3: `CLAUDE.md` にコード規約セクションを追記**

ファイル末尾（既存のNxセクションの下）に以下を追加:

```markdown

## コード規約

- `any` は原則として使用しない（Biome `noExplicitAny` で error）
- if 文に続く制御ブロックは1行でも必ず `{}` で囲う（Biome `useBlockStatements` で error）
- コードコメントは日本語で記述する
- コミット前に `pnpm nx affected -t lint test` がグリーンであること（pre-commit-gate hook で自動検査）

## 失敗時の自動記録

タスクが失敗・誤りだった場合、以下を必ず実行する:

1. 失敗の原因を簡潔に分析する
2. 適切な場所に記録する:
   - プロジェクト固有 → `memory/YYYY-MM-DD-<topic>.md`
   - 汎用パターン → `rules/<rule-name>.md`
3. 同じ失敗が `memory/` に2回以上記録されている場合は、`rules/` に昇格させる

詳細: `memory/README.md`, `rules/README.md`
```

- [ ] **Step 4: コミット**

```bash
git add -A && git commit -m "docs: memory/ rules/ ドキュメントとコード規約を追記

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5: CI

### Task 19: GitHub Actions CI ワークフロー追加

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: `.github/workflows/ci.yml` を作成**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - uses: nrwl/nx-set-shas@v4

      - name: Biome (format + lint)
        run: pnpm exec biome ci .

      - name: Typecheck + Unit tests
        run: pnpm nx affected -t typecheck test --parallel=3

      - name: Build
        run: pnpm nx affected -t build --parallel=3

      - name: Install Playwright Browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E
        run: pnpm nx affected -t e2e
```

- [ ] **Step 2: コミット**

```bash
git add -A && git commit -m "ci: GitHub Actions ワークフロー追加 (biome/typecheck/test/build/e2e)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6: 全体検証

### Task 20: モノレポ全体の検証と仕上げ

**Files:**
- 必要に応じて軽微な修正のみ

- [ ] **Step 1: 全プロジェクトの typecheck**

```bash
cd /Users/ikomiki/workspace/game-workspace && pnpm nx run-many -t typecheck
```

期待: すべて PASS。

- [ ] **Step 2: 全プロジェクトの test**

```bash
pnpm nx run-many -t test
```

期待: すべて PASS。

- [ ] **Step 3: ビルド可能性検証**

```bash
pnpm nx run-many -t build
```

期待: game-core / audio / ui / sample-game がビルド成功。

- [ ] **Step 4: Biome の総合チェック**

```bash
pnpm exec biome ci .
```

期待: format/lint 違反なし。違反があればその場で修正してから次へ。

- [ ] **Step 5: 依存グラフの可視化**

```bash
pnpm nx graph --file=/tmp/graph.html
```

期待: ファイル生成。`apps/sample-game` から `packages/{ui,game-core,audio}` への一方向矢印を確認（手動）。

- [ ] **Step 6: E2E 通過確認**

```bash
pnpm nx e2e sample-game
```

期待: 1 passed。

- [ ] **Step 7: README 更新（任意）**

ルート `README.md` の冒頭に「複数ゲームの開発基盤」と一文を追加し、`pnpm nx serve sample-game` で起動できる旨を記載。Nxの初期テンプレートはそのまま残す。

- [ ] **Step 8: 仕上げコミット（変更があれば）**

```bash
git status
# 何か未コミットがあれば
git add -A && git commit -m "chore: モノレポ全体検証の仕上げ

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 自己レビュー結果

- **spec カバレッジ**: 設計書の各セクション（ディレクトリ/Catalogs/config-*/Hooks/失敗記録/テスト/CI/初期サンプル/成功基準）すべてに対応するタスクが存在。
- **プレースホルダ**: なし。すべてのコードブロックは実コード。
- **型/シグネチャ整合**: `createScoreStore`, `parseSaveData`, `useGameSound`, `useSampleGame`, `ScoreHud`, `GameCanvas` の名称・引数・戻り値が前後タスクで一致。
- **Tailwind v4対応**: JS preset ではなく CSS `@theme` をconfig-tailwindから配布する形に修正済み。
- **TDD**: ロジック層（score, save, useGameSound, ScoreHud, sample-game の振る舞い）はすべて Red → Green。スキャフォールドのみのタスク（generator的）は除く。
- **コミット粒度**: 各タスク末尾で1コミット。Phase内でも論理単位ごとにコミットされる。

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-10-nx-monorepo.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 1タスクごとに新規サブエージェントを起動、タスク間でレビュー、メイン会話の文脈は短く保てる
**2. Inline Execution** — 本セッションで連続実行、チェックポイントでレビュー

**Which approach?**
