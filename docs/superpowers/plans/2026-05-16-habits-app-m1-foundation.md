# Habits App — M1: Workspace Foundation 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設計仕様 `docs/superpowers/specs/2026-05-16-habits-app-design.md` の M1（Workspace Foundation）を完了し、`apps/habits/` の Vite 開発サーバーが起動して TanStack Router 経由でプレースホルダ画面（`/today`, `/auth/login`）を表示できる状態にする。

**Architecture:** Nx モノレポに `apps/habits/`（Vite + React + Tailwind v4 + TanStack Router）と空のドメインパッケージ `packages/habit-core/`、同期層パッケージ `packages/habit-sync/` を新規追加する。M1 ではコード本体は雛形（型・公開 API のみ）に留め、ドメインロジックは M4 以降で実装する。

**Tech Stack:** pnpm 11 (catalogs) / Nx 22 / Vite 7 / React 19 / Tailwind CSS v4 / TanStack Router 1.x / TypeScript 5.9 / vitest 3 / Biome 2.x

**前提条件:**
- 設計仕様: `docs/superpowers/specs/2026-05-16-habits-app-design.md`
- 既存パッケージ `packages/config-{biome,tsconfig,tailwind,vitest}` は維持
- ローカル Supabase の導入は M2 で実施（このプランでは扱わない）
- 認証ロジック・状態管理ロジックは M3 以降で実装（このプランでは雛形のみ）

---

## ファイル構造（作成・変更対象）

```
README.md                                      編集（sample-game 記述を全削除し habits 用に書き換え）
pnpm-workspace.yaml                            編集（catalog に新依存追加）
packages/ui/package.json                       既存編集（@org/audio 依存削除）※未コミットなら本タスクで含める
packages/ui/vitest.config.ts                   既存編集（passWithNoTests）※未コミットなら本タスクで含める
packages/ui/src/index.ts                       既存編集（空プレースホルダ）※未コミットなら本タスクで含める
pnpm-lock.yaml                                 自動再生成

packages/habit-core/
  package.json                                 新規
  tsconfig.json                                新規（LSP用）
  tsconfig.lib.json                            新規（ビルド用）
  biome.json                                   新規
  vitest.config.ts                             新規
  README.md                                    新規
  src/
    index.ts                                   新規（型と関数を export する公開境界）
    frequency.ts                               新規（雛形: 型定義と未実装関数）
    streak.ts                                  新規（雛形）
    status.ts                                  新規（型定義のみ）
    index.test.ts                              新規（公開 API のスモークテスト）

packages/habit-sync/
  package.json                                 新規
  tsconfig.json                                新規
  tsconfig.lib.json                            新規
  biome.json                                   新規
  vitest.config.ts                             新規
  README.md                                    新規
  src/
    index.ts                                   新規（公開 API）
    supabase.ts                                新規（雛形: クライアント生成関数）
    observables.ts                             新規（雛形: 状態スケルトン）
    notify/
      NotificationProvider.ts                  新規（インターフェース定義）
    index.test.ts                              新規（スモークテスト）

apps/habits/
  package.json                                 新規
  index.html                                   新規
  vite.config.ts                               新規
  tsconfig.json                                新規（LSP用）
  tsconfig.app.json                            新規（ビルド用）
  biome.json                                   新規
  public/.gitkeep                              新規
  e2e/.gitkeep                                 新規（M12 の Playwright 用の placeholder ディレクトリ）
  src/
    main.tsx                                   新規（エントリ）
    App.tsx                                    新規（RouterProvider のラッパー）
    styles.css                                 新規（@import "@org/config-tailwind/theme.css"）
    router.tsx                                 新規（code-based ルートツリー + プレースホルダコンポーネント）
    App.test.tsx                               新規（プレースホルダ画面のスモークテスト）
```

**依存方向:**
```
apps/habits → packages/{habit-sync, habit-core, ui, config-*}
packages/habit-sync → packages/habit-core
packages/ui → packages/habit-core （型のみ、本タスクでは未参照で OK）
```

---

## Task 1: workspace の未コミット状態を整理し、新方針の README とともにコミット

**目的:** sample-game / audio / game-core の削除と packages/ui の最小整理を最初のコミットとして固める。これにより、後続タスクが「habits 専用の追加」だけを差分として扱える。

**Files:**
- Modify: `README.md`（全面書き換え）
- Stage: 既存の `D` / `M` ファイル（`git status` で確認できる範囲）
- Create: なし（このタスクは既存変更の整理）

- [ ] **Step 1: 現在の未コミット状態を確認する**

```bash
git status --short
```

Expected: `D apps/sample-game/...`, `D packages/audio/...`, `D packages/game-core/...`, `D packages/ui/src/ScoreHud.*`, `M packages/ui/{package.json,src/index.ts,vitest.config.ts}`, `M pnpm-lock.yaml`, `M pnpm-workspace.yaml`, `M README.md`, `D docs/superpowers/specs/2026-05-10-nx-monorepo-design.md` などが並ぶ。

- [ ] **Step 2: packages/ui の中身を空プレースホルダに整える**

`packages/ui/src/index.ts` を以下に置き換える（既存と同等の最小公開）:

```ts
// habits アプリ用の共有 UI コンポーネントを今後ここに追加する。
// 移行期のためまだ実体はなく、パッケージ名のみエクスポートしてプロジェクトの存在を保証する。
export const PACKAGE_NAME = 'ui';
```

`packages/ui/package.json` の `dependencies` から `@org/audio` への参照を削除（既に削除済みの場合はスキップ）:

```json
{
  "name": "@org/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "@org/source": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./styles.css": "./src/styles.css"
  },
  "dependencies": {
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

`packages/ui/vitest.config.ts`（移行期のため一時的に `passWithNoTests`、Task 3 以降で habit-core がテストを持つので将来削除可能）:

```ts
import { mergeConfig } from 'vitest/config';
import base from '@org/config-vitest/react';

// 移行期: 実コンポーネント未実装のため一時的に passWithNoTests を許容。
// habit アプリの UI コンポーネントを `packages/ui` に追加した時点でこのオプションは外す。
export default mergeConfig(base, {
  test: { passWithNoTests: true },
});
```

- [ ] **Step 3: README.md を新方針に書き換える**

ファイル全体を以下に置き換える:

```markdown
# daily-task

毎日の習慣タスクを管理する Web アプリを開発する Nx モノレポ。
Vite + React 19 + Tailwind CSS v4 + TanStack Router + legend-state + Supabase を共通基盤として、
`apps/habits` に Web アプリ本体、`packages/*` にドメインロジック・同期層・共有設定を集める。

## クイックスタート

```bash
pnpm install
pnpm nx serve habits        # http://localhost:5173 で起動
```

> ローカル Supabase の起動は M2 マイルストーンで導入される（`supabase start`）。
> 現時点では認証や状態同期はスタブで動作する。

## ディレクトリ

```
apps/
  habits/             Web SPA（Vite + React + Tailwind + TanStack Router）
packages/
  habit-core/         純粋ドメイン（頻度評価 / streak / status 型）
  habit-sync/         legend-state + Supabase 同期層、IndexedDB 永続化
  ui/                 React + Tailwind の共有 UI（移行期は空）
  config-biome/       共有 biome.json
  config-tsconfig/    base / lib / app の 3 層 tsconfig
  config-tailwind/    Tailwind v4 の @theme プリセット
  config-vitest/      vitest の node / react プリセット
supabase/             ローカル Supabase ワークスペース（M2 で追加）
.claude/              Claude Code の hooks / commands / settings
.github/workflows/    GitHub Actions CI
docs/superpowers/     設計書（specs/）と実装プラン（plans/）
memory/, rules/       失敗事例ログとルール
```

依存方向は `apps/habits → packages/{habit-sync, habit-core, ui} → packages/config-*` の一方向のみ。

## 主なコマンド

```bash
# 開発
pnpm nx serve habits                       # Vite dev (5173)
pnpm nx test <project>                     # 単一プロジェクトの vitest
pnpm nx test <project> -- -t "テスト名"     # 単一テスト
pnpm nx graph                              # 依存グラフを可視化

# 検証（ローカルで run-many する場合は CI=true を付ける）
CI=true pnpm nx run-many -t typecheck test
CI=true pnpm nx affected -t typecheck test
pnpm nx build habits
pnpm nx e2e habits                         # Playwright（M12 で本格利用）
pnpm exec biome ci .                       # format + lint チェック
pnpm exec biome check --write .            # 自動修正
```

## 採用している技術スタック

| 領域                 | ツール                                                          |
| -------------------- | --------------------------------------------------------------- |
| パッケージ管理       | pnpm 11 + Catalogs（バージョン単一ソース化）                    |
| モノレポ             | Nx 22 + `@nx/js`/`@nx/vite`/`@nx/playwright` プラグイン         |
| 言語                 | TypeScript 5.9（strict + customConditions で source 直接解決）  |
| Linter/Formatter     | Biome 2.x（ESLint/Prettier 不採用）                             |
| ビルド/テスト        | Vite 7 + vitest 3 + @testing-library + jsdom                    |
| E2E                  | Playwright                                                      |
| UI                   | React 19 + Tailwind CSS v4（CSS-first）                         |
| ルーティング         | TanStack Router 1.x                                             |
| 状態管理 / 同期      | legend-state 3.x + `@legendapp/state/sync-plugins/supabase`     |
| バックエンド         | Supabase（ローカル Docker）                                     |
| バリデーション       | Zod 4                                                           |

## 開発方針

- **TDD**: 実装前に失敗するテストを書く（`superpowers:test-driven-development`）
- **共有設定の単一ソース**: Biome / tsconfig / Tailwind / vitest はすべて `packages/config-*` 経由
- **Catalogs**: 全依存のバージョンは `pnpm-workspace.yaml` の `catalog:` 1 ヶ所のみ
- **Claude Hooks**: `Edit/Write` 直後に Biome format、`git commit` 前に `nx affected -t lint test`
- **Superpowers**: `docs/superpowers/specs/` で設計合意 → `docs/superpowers/plans/` で実装プラン → サブエージェント駆動実装

## コード規約

- `any` は使用しない（Biome `noExplicitAny: error`）
- if 文の制御ブロックは 1 行でも `{}` で囲う（Biome `useBlockStatements: error`）
- コードコメントは日本語
- 詳細は `CLAUDE.md`、失敗事例の運用は `memory/README.md` / `rules/README.md`

## CI

`.github/workflows/ci.yml` で `pnpm install` → `biome ci` → `nx affected -t typecheck test build` → Playwright E2E。
PR では `nrwl/nx-set-shas@v4` で base/head を解決し affected のみ実行する。
```

- [ ] **Step 4: lint / typecheck / test がローカルで通ることを確認**

```bash
CI=true pnpm nx affected -t typecheck lint test
```

Expected: `Successfully ran target ...` で全て緑。`@org/ui:test` は `No test files found, exiting with code 0` となれば OK（`passWithNoTests`）。

- [ ] **Step 5: 変更を全部ステージしコミット**

```bash
git add README.md packages/ui/package.json packages/ui/src/index.ts packages/ui/vitest.config.ts pnpm-lock.yaml pnpm-workspace.yaml \
        apps/sample-game packages/audio packages/game-core packages/ui/src/ScoreHud.test.tsx packages/ui/src/ScoreHud.tsx \
        docs/superpowers/specs/2026-05-10-nx-monorepo-design.md
git status --short
```

Expected: すべての関連ファイルが `A` / `M` / `D` でステージされ、ワーキングツリーがクリーンに近い。

```bash
git commit -m "$(cat <<'EOF'
chore: sample-game / audio / game-core を撤去し habits アプリ方針に書き換え

- apps/sample-game, packages/{audio,game-core} を削除
- packages/ui を空プレースホルダ化（@org/audio 依存削除、passWithNoTests を一時許可）
- README を habits アプリ前提に全面書き換え
- pnpm-lock.yaml を pnpm-workspace.yaml と同期

設計仕様: docs/superpowers/specs/2026-05-16-habits-app-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: pre-commit-gate hook が緑で commit 成功。

---

## Task 2: pnpm-workspace.yaml の catalog に habits 用依存を追加

**目的:** habits アプリと habit-sync で使う依存のバージョンを単一ソース化する。

**Files:**
- Modify: `pnpm-workspace.yaml`
- Generate: `pnpm-lock.yaml`（自動）

- [ ] **Step 1: pnpm-workspace.yaml の catalog セクションを編集**

`pnpm-workspace.yaml` の `catalog:` セクションに以下を追記する。既存の React / Vite / Tailwind / Vitest セクションはそのまま残す:

```yaml
catalog:
  # React（既存）
  react: ^19.0.0
  react-dom: ^19.0.0
  "@types/react": ^19.0.0
  "@types/react-dom": ^19.0.0

  # ビルド/バンドル（既存）
  vite: ^7.0.0
  "@vitejs/plugin-react": ^5.0.0

  # スタイリング（既存）
  tailwindcss: ^4.0.0
  "@tailwindcss/vite": ^4.0.0

  # 状態管理 / バリデーション
  zod: ^4.0.0
  "@legendapp/state": ^3.0.0

  # ルーティング（M1 は code-based のみ。file-based 移行時に @tanstack/router-plugin を追加）
  "@tanstack/react-router": ^1.0.0

  # Supabase
  "@supabase/supabase-js": ^2.0.0

  # PWA / Service Worker
  "vite-plugin-pwa": ^1.0.0
  "workbox-window": ^7.0.0

  # テスト（既存）
  vitest: ^3.0.0
  "@vitest/ui": ^3.0.0
  "@testing-library/react": ^16.0.0
  "@testing-library/jest-dom": ^6.0.0
  "@testing-library/user-event": ^14.0.0
  jsdom: ^26.0.0
  "@playwright/test": ^1.50.0

  # Linter/Formatter（既存）
  "@biomejs/biome": ^2.0.0

  # TypeScript（既存）
  typescript: ~5.9.2
```

> **注:** `minimumReleaseAge: 4320` が有効。これらの依存の最新バージョンが直近 72 時間以内にリリースされたものだと `pnpm install` でブロックされる。その場合は `minimumReleaseAgeExclude` に `<pkg>@<version>` を追加するか、より古い安定版に下げる。

- [ ] **Step 2: pnpm install で lockfile を更新**

```bash
pnpm install
```

Expected: `Done in ... using pnpm v11.x` で正常終了。`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` が出る場合は `pnpm install --no-frozen-lockfile` を使う。

エラー（例: minimumReleaseAge）が出たら、表示された `<pkg>@<version>` を `minimumReleaseAgeExclude` に追加してリトライ。

- [ ] **Step 3: 変更をコミット**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore: pnpm-workspace.yaml の catalog に habits 用依存を追加

- @legendapp/state, @supabase/supabase-js, @tanstack/react-router, vite-plugin-pwa を catalog 化
- M1 以降のパッケージ / アプリから "catalog:" 参照で利用する

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: pre-commit-gate hook 緑、commit 成功。

---

## Task 3: packages/habit-core パッケージを scaffold

**目的:** ドメインロジック（頻度評価 / streak 計算 / status 型）の入れ物を作る。実装本体は M4 で行うため、本タスクでは型定義と未実装関数（throw）に留め、テストは公開 API の存在だけスモークで確認する。

**Files:**
- Create: `packages/habit-core/package.json`
- Create: `packages/habit-core/tsconfig.json`
- Create: `packages/habit-core/tsconfig.lib.json`
- Create: `packages/habit-core/biome.json`
- Create: `packages/habit-core/vitest.config.ts`
- Create: `packages/habit-core/README.md`
- Create: `packages/habit-core/src/index.ts`
- Create: `packages/habit-core/src/frequency.ts`
- Create: `packages/habit-core/src/streak.ts`
- Create: `packages/habit-core/src/status.ts`
- Create: `packages/habit-core/src/index.test.ts`

- [ ] **Step 1: ディレクトリを作成**

```bash
mkdir -p packages/habit-core/src
```

- [ ] **Step 2: package.json を作成**

```json
{
  "name": "@org/habit-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "@org/source": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "devDependencies": {
    "@org/config-biome": "workspace:*",
    "@org/config-tsconfig": "workspace:*",
    "@org/config-vitest": "workspace:*",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 3: tsconfig.json（LSP用）を作成**

```json
{
  "extends": "@org/config-tsconfig/base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: tsconfig.lib.json（ビルド用）を作成**

```json
{
  "extends": "@org/config-tsconfig/lib.json",
  "compilerOptions": { "outDir": "./dist" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 5: biome.json を作成**

```json
{ "extends": ["@org/config-biome/biome.json"] }
```

- [ ] **Step 6: vitest.config.ts を作成（node preset）**

```ts
import base from '@org/config-vitest/node';
export default base;
```

- [ ] **Step 7: src/status.ts を作成**

```ts
// タスクの状態型。'empty' は DB 上の行不在を表す論理状態のため
// この型には含めず、null/undefined 等で外側が表現する。
export type TaskStatus = 'complete' | 'skip' | 'fail';

// UI/集計での「未操作」を含む拡張状態
export type DisplayTaskStatus = TaskStatus | 'empty';
```

- [ ] **Step 8: src/frequency.ts を作成（型のみ実装、関数本体は M4 で）**

```ts
// 頻度ルールの判別共用体。
// 詳細仕様は docs/superpowers/specs/2026-05-16-habits-app-design.md §5.2
export type Frequency =
  | { type: 'daily' }
  | { type: 'every_n_days'; n: number; anchor: string }
  | { type: 'weekday'; days: number[] } // 1=月..7=日
  | {
      type: 'day_of_week';
      days: number[];
      weeks_of_month?: number[];
    }
  | { type: 'every_n_weeks'; n: number; day_of_week: number; anchor: string };

// 指定日にタスクが頻度ルールにマッチするかを返す。
// 実装本体は M4（packages/habit-core 実装フェーズ）で行う。
// 引数 date / anchor は 'YYYY-MM-DD' 形式のローカル日付文字列。
export function isDueOn(
  _rule: Frequency,
  _date: string,
  _taskCreatedAt: string,
): boolean {
  throw new Error('NOT_IMPLEMENTED: isDueOn は M4 で実装する');
}
```

- [ ] **Step 9: src/streak.ts を作成（型・シグネチャのみ、関数本体は M4 で）**

```ts
import type { TaskStatus } from './status.ts';

// 日付昇順の log 一覧から最新の連続完了数（streak）を算出する。
// ルール:
//   - complete: streak +1
//   - skip:     streak 維持（増えない）
//   - fail:     streak を 0 にリセット
//   - 頻度外:   呼び出し側で除外して渡す
// 実装本体は M4 で行う。
export interface LogEntry {
  date: string; // 'YYYY-MM-DD'
  status: TaskStatus;
}

export function calculateStreak(_logsAsc: LogEntry[]): number {
  throw new Error('NOT_IMPLEMENTED: calculateStreak は M4 で実装する');
}
```

- [ ] **Step 10: src/index.ts を作成（公開 API）**

```ts
export type { Frequency } from './frequency.ts';
export type { TaskStatus, DisplayTaskStatus } from './status.ts';
export type { LogEntry } from './streak.ts';
export { isDueOn } from './frequency.ts';
export { calculateStreak } from './streak.ts';
```

- [ ] **Step 11: src/index.test.ts でスモークテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { calculateStreak, isDueOn } from './index.ts';
import type { DisplayTaskStatus, Frequency, LogEntry, TaskStatus } from './index.ts';

describe('@org/habit-core 公開 API スモーク', () => {
  it('型 Frequency が判別可能であること', () => {
    const f: Frequency = { type: 'daily' };
    expect(f.type).toBe('daily');
  });

  it('TaskStatus と DisplayTaskStatus が想定の値を取れること', () => {
    const s: TaskStatus = 'complete';
    const d: DisplayTaskStatus = 'empty';
    expect([s, d]).toEqual(['complete', 'empty']);
  });

  it('LogEntry を配列で扱えること', () => {
    const logs: LogEntry[] = [{ date: '2026-05-16', status: 'complete' }];
    expect(logs).toHaveLength(1);
  });

  it('isDueOn は M4 まで未実装のため throw する', () => {
    expect(() => isDueOn({ type: 'daily' }, '2026-05-16', '2026-05-16')).toThrow(
      /NOT_IMPLEMENTED/,
    );
  });

  it('calculateStreak は M4 まで未実装のため throw する', () => {
    expect(() => calculateStreak([])).toThrow(/NOT_IMPLEMENTED/);
  });
});
```

- [ ] **Step 12: README.md を作成**

```markdown
# @org/habit-core

habits アプリの純粋ドメインロジック。副作用を持たない、TypeScript ネイティブのライブラリ。

## 公開 API

- `Frequency` — 頻度ルールの判別共用体（毎日 / n 日に 1 回 / 曜日 / 第 n 週指定 / n 週に 1 回）
- `isDueOn(rule, date, taskCreatedAt)` — 指定日にルールが該当するか（M4 で実装）
- `TaskStatus`, `DisplayTaskStatus` — タスク状態型
- `LogEntry`, `calculateStreak(logsAsc)` — 連続完了数（M4 で実装）

## 設計参照

- 設計仕様: `docs/superpowers/specs/2026-05-16-habits-app-design.md` §5.2 / §6.3
```

- [ ] **Step 13: パッケージを workspace に認識させる**

```bash
pnpm install
```

Expected: `+ @org/habit-core ...` などのログ。エラーがあれば package.json を見直す。

- [ ] **Step 14: typecheck / test / lint がパスすることを確認**

```bash
CI=true pnpm nx run @org/habit-core:typecheck
CI=true pnpm nx run @org/habit-core:test
pnpm exec biome ci packages/habit-core/
```

Expected: すべて緑。test では 5 テストが pass。

- [ ] **Step 15: コミット**

```bash
git add packages/habit-core pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(habit-core): 純粋ドメインの雛形パッケージを追加

- Frequency / TaskStatus / LogEntry の型を定義
- isDueOn / calculateStreak は型シグネチャのみ（M4 で実装）
- 公開 API のスモークテストを vitest で配置

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: pre-commit-gate hook 緑、commit 成功。

---

## Task 4: packages/habit-sync パッケージを scaffold

**目的:** legend-state + Supabase 同期層の入れ物を作る。具体的な同期実装は M5 で行うため、本タスクではクライアント生成関数のシグネチャ、observable のプレースホルダ、NotificationProvider インターフェースに留める。

**Files:**
- Create: `packages/habit-sync/package.json`
- Create: `packages/habit-sync/tsconfig.json`
- Create: `packages/habit-sync/tsconfig.lib.json`
- Create: `packages/habit-sync/biome.json`
- Create: `packages/habit-sync/vitest.config.ts`
- Create: `packages/habit-sync/README.md`
- Create: `packages/habit-sync/src/index.ts`
- Create: `packages/habit-sync/src/supabase.ts`
- Create: `packages/habit-sync/src/observables.ts`
- Create: `packages/habit-sync/src/notify/NotificationProvider.ts`
- Create: `packages/habit-sync/src/index.test.ts`

- [ ] **Step 1: ディレクトリを作成**

```bash
mkdir -p packages/habit-sync/src/notify
```

- [ ] **Step 2: package.json を作成**

```json
{
  "name": "@org/habit-sync",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "@org/source": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "dependencies": {
    "@org/habit-core": "workspace:*",
    "@legendapp/state": "catalog:",
    "@supabase/supabase-js": "catalog:"
  },
  "devDependencies": {
    "@org/config-biome": "workspace:*",
    "@org/config-tsconfig": "workspace:*",
    "@org/config-vitest": "workspace:*",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 3: tsconfig.json / tsconfig.lib.json を作成**

`packages/habit-sync/tsconfig.json`:
```json
{
  "extends": "@org/config-tsconfig/base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

`packages/habit-sync/tsconfig.lib.json`:
```json
{
  "extends": "@org/config-tsconfig/lib.json",
  "compilerOptions": { "outDir": "./dist" },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 4: biome.json / vitest.config.ts を作成**

`packages/habit-sync/biome.json`:
```json
{ "extends": ["@org/config-biome/biome.json"] }
```

`packages/habit-sync/vitest.config.ts`:
```ts
import base from '@org/config-vitest/node';
export default base;
```

- [ ] **Step 5: src/supabase.ts を作成（雛形）**

```ts
import { type SupabaseClient, createClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// Supabase クライアントのシングルトンを生成する。
// M5 でこのクライアントを legend-state の syncedSupabase に渡す。
let client: SupabaseClient | null = null;

export function getSupabaseClient(config: SupabaseConfig): SupabaseClient {
  if (client !== null) {
    return client;
  }
  client = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

// テスト用にシングルトンをリセットする。
export function resetSupabaseClient(): void {
  client = null;
}
```

- [ ] **Step 6: src/observables.ts を作成（雛形）**

```ts
import { observable } from '@legendapp/state';

// 同期 observable の root。
// M5 で syncedSupabase / IndexedDB 永続化を追加する。
// 現時点では型骨格のみで、実体は空オブジェクト。
export const state$ = observable({
  user: null as { id: string; email: string } | null,
  time_slots: {} as Record<string, unknown>,
  tasks: {} as Record<string, unknown>,
  task_logs: {} as Record<string, unknown>,
});

export type SyncState = typeof state$;
```

- [ ] **Step 7: src/notify/NotificationProvider.ts を作成（インターフェース定義）**

```ts
// 通知バックエンドの抽象。
// v1 = WebNotificationProvider（フォアグラウンドのみ）
// 将来 = TauriNotificationProvider（tauri-plugin-notification）
// 詳細: docs/superpowers/specs/2026-05-16-habits-app-design.md §7.3

export type PermissionState = 'granted' | 'denied' | 'prompt';

export interface SlotSchedule {
  slotId: string;
  slotName: string;
  notifyAt: string; // 'HH:MM' 形式（ローカル）
}

export interface NotificationProvider {
  requestPermission(): Promise<PermissionState>;
  scheduleDaily(slots: SlotSchedule[]): void;
  cancelAll(): void;
}
```

- [ ] **Step 8: src/index.ts で公開 API を集約**

```ts
export { getSupabaseClient, resetSupabaseClient } from './supabase.ts';
export type { SupabaseConfig } from './supabase.ts';
export { state$ } from './observables.ts';
export type { SyncState } from './observables.ts';
export type {
  NotificationProvider,
  PermissionState,
  SlotSchedule,
} from './notify/NotificationProvider.ts';
```

- [ ] **Step 9: src/index.test.ts でスモークテストを書く**

```ts
import { afterEach, describe, expect, it } from 'vitest';
import {
  getSupabaseClient,
  resetSupabaseClient,
  state$,
  type NotificationProvider,
  type SupabaseConfig,
} from './index.ts';

const config: SupabaseConfig = {
  url: 'http://localhost:54321',
  anonKey: 'eyJ-dummy-anon-key-for-test',
};

describe('@org/habit-sync 公開 API スモーク', () => {
  afterEach(() => {
    resetSupabaseClient();
  });

  it('getSupabaseClient はシングルトンを返す', () => {
    const a = getSupabaseClient(config);
    const b = getSupabaseClient(config);
    expect(a).toBe(b);
  });

  it('resetSupabaseClient 後は新しいインスタンスになる', () => {
    const a = getSupabaseClient(config);
    resetSupabaseClient();
    const b = getSupabaseClient(config);
    expect(a).not.toBe(b);
  });

  it('state$ が legend-state observable として動作する', () => {
    expect(state$.user.get()).toBeNull();
    state$.user.set({ id: 'u1', email: 'a@b.co' });
    expect(state$.user.get()).toEqual({ id: 'u1', email: 'a@b.co' });
    state$.user.set(null);
  });

  it('NotificationProvider インターフェースを実装できる', () => {
    const stub: NotificationProvider = {
      requestPermission: async () => 'granted',
      scheduleDaily: () => {},
      cancelAll: () => {},
    };
    expect(typeof stub.requestPermission).toBe('function');
  });
});
```

- [ ] **Step 10: README.md を作成**

```markdown
# @org/habit-sync

habits アプリの同期層。legend-state を中心に Supabase との双方向同期と IndexedDB 永続化を担当する。

## 公開 API（M1 時点）

- `getSupabaseClient(config)` / `resetSupabaseClient()` — Supabase クライアントのシングルトン
- `state$` — legend-state observable の root（M5 で syncedSupabase を結線）
- `NotificationProvider`, `PermissionState`, `SlotSchedule` — 通知バックエンドの抽象

## 設計参照

- 設計仕様: `docs/superpowers/specs/2026-05-16-habits-app-design.md` §6 / §7
```

- [ ] **Step 11: workspace に認識させる**

```bash
pnpm install
```

- [ ] **Step 12: typecheck / test / lint がパスすることを確認**

```bash
CI=true pnpm nx run @org/habit-sync:typecheck
CI=true pnpm nx run @org/habit-sync:test
pnpm exec biome ci packages/habit-sync/
```

Expected: すべて緑。test では 4 テストが pass。

- [ ] **Step 13: コミット**

```bash
git add packages/habit-sync pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(habit-sync): legend-state + Supabase 同期層の雛形パッケージを追加

- Supabase クライアントのシングルトン生成関数
- legend-state observable の root（M5 で syncedSupabase を結線）
- NotificationProvider インターフェース

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: apps/habits アプリを Vite + React + Tailwind で scaffold

**目的:** `pnpm nx serve habits` で Vite 開発サーバーが起動し、Tailwind が効いた状態の空画面を表示できるところまで作る。ルーティングは Task 6 で追加する。

**Files:**
- Create: `apps/habits/package.json`
- Create: `apps/habits/index.html`
- Create: `apps/habits/vite.config.ts`
- Create: `apps/habits/tsconfig.json`
- Create: `apps/habits/tsconfig.app.json`
- Create: `apps/habits/biome.json`
- Create: `apps/habits/public/.gitkeep`
- Create: `apps/habits/e2e/.gitkeep`
- Create: `apps/habits/src/main.tsx`
- Create: `apps/habits/src/App.tsx`
- Create: `apps/habits/src/styles.css`
- Create: `apps/habits/src/App.test.tsx`

- [ ] **Step 1: ディレクトリ・空ファイルを作成**

```bash
mkdir -p apps/habits/src apps/habits/public apps/habits/e2e
touch apps/habits/public/.gitkeep apps/habits/e2e/.gitkeep
```

- [ ] **Step 2: package.json を作成**

```json
{
  "name": "@org/habits",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@org/habit-core": "workspace:*",
    "@org/habit-sync": "workspace:*",
    "@org/ui": "workspace:*",
    "@legendapp/state": "catalog:",
    "@supabase/supabase-js": "catalog:",
    "@tanstack/react-router": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@org/config-biome": "workspace:*",
    "@org/config-tailwind": "workspace:*",
    "@org/config-tsconfig": "workspace:*",
    "@org/config-vitest": "workspace:*",
    "@tailwindcss/vite": "catalog:",
    "@testing-library/jest-dom": "catalog:",
    "@testing-library/react": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "jsdom": "catalog:",
    "vite": "catalog:",
    "vite-plugin-pwa": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 3: index.html を作成**

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Habits</title>
  </head>
  <body class="bg-game-bg text-game-fg">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: tsconfig.json / tsconfig.app.json を作成**

`apps/habits/tsconfig.json`:
```json
{
  "extends": "@org/config-tsconfig/app.json",
  "include": ["src/**/*.ts", "src/**/*.tsx", "vite.config.ts", "vitest.config.ts"]
}
```

`apps/habits/tsconfig.app.json`:
```json
{
  "extends": "@org/config-tsconfig/app.json",
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
}
```

- [ ] **Step 5: biome.json を作成**

```json
{ "extends": ["@org/config-biome/biome.json"] }
```

- [ ] **Step 6: vite.config.ts を作成（PWA / TanStack Router plugin は次タスク以降で追加。本タスクでは最小構成）**

```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['@org/config-vitest/setup'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: { port: 5173 },
});
```

- [ ] **Step 7: styles.css を作成（Tailwind v4 + 共通テーマ）**

```css
@import 'tailwindcss';
@import '@org/config-tailwind/theme.css';

body {
  font-family: var(--font-display);
  margin: 0;
}
```

- [ ] **Step 8: src/App.tsx を最小実装（Tailwind が効いていることを確認できる）**

```tsx
// M1 マイルストーンのプレースホルダ画面。
// Task 6 / 7 で TanStack Router 経由のルートに置き換える。
export default function App(): React.ReactElement {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <section className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-game-accent">Habits</h1>
        <p className="text-base">
          毎日の習慣を続けるためのアプリ — M1 スキャフォールド完了
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 9: src/main.tsx を作成**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './styles.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('#root が index.html に見つかりません');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 10: src/App.test.tsx を作成（Tailwind / 文言の存在テスト）**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';

describe('App プレースホルダ', () => {
  it('Habits タイトルを表示する', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Habits' })).toBeInTheDocument();
  });

  it('M1 スキャフォールドの説明文を表示する', () => {
    render(<App />);
    expect(
      screen.getByText(/M1 スキャフォールド完了/),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: workspace に認識させる**

```bash
pnpm install
```

- [ ] **Step 12: typecheck / test / lint がパスすることを確認**

```bash
CI=true pnpm nx run @org/habits:typecheck
CI=true pnpm nx run @org/habits:test
pnpm exec biome ci apps/habits/
```

Expected: すべて緑。test では 2 テストが pass。

- [ ] **Step 13: dev サーバーが起動することを確認（手動）**

```bash
pnpm nx serve habits
```

Expected: `http://localhost:5173/` で起動。ブラウザで開くと「Habits」見出しと M1 スキャフォールド完了の文字が表示される。背景色（`--color-game-bg`）が反映されていることを確認。

`Ctrl+C` で停止。

- [ ] **Step 14: コミット**

```bash
git add apps/habits pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(habits): Vite + React + Tailwind v4 でアプリ雛形を作成

- TanStack Router / PWA / Supabase 連携は後続タスクで追加
- styles.css は @org/config-tailwind/theme.css を import
- App.tsx は M1 プレースホルダ、smoke test 付き

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: TanStack Router でルート骨格を追加し、`/today` と `/auth/login` のプレースホルダを配置

**目的:** `pnpm nx serve habits` で `/` を開くと `/today` にリダイレクトされ、`/auth/login` でログイン用のプレースホルダ画面が表示される状態にする。M3 以降のルート追加（settings, tasks, history, signup 等）はここで追加する基盤の上に乗せる。

**ルーティング方式の選択:** code-based ルーティングを採用する（`createRoute` を使い、`router.ts` で手動でツリーを組む）。理由: file-based ルーティングは `@tanstack/router-plugin/vite` が `routeTree.gen.ts` を自動生成するが、生成物がないと typecheck が落ちる chicken-and-egg 問題があり、M1 のスキャフォールド段階では避けたい。M2 以降でルートが増えてきたら file-based 移行を検討する。

**Files:**
- Create: `apps/habits/src/router.tsx`（route 定義と RouterProvider 用設定）
- Modify: `apps/habits/src/App.tsx`（RouterProvider 化）
- Modify: `apps/habits/src/App.test.tsx`（リダイレクト・各ルートの表示確認）
- Modify: `apps/habits/vite.config.ts`（必要なら router devtools 用 plugin 追加。M1 では skip）

- [ ] **Step 1: src/router.tsx を作成（code-based でルートツリーを構築）**

```tsx
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

const rootRoute = createRootRoute({
  component: () => (
    <main className="min-h-screen">
      <Outlet />
    </main>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/today' });
  },
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/today',
  component: TodayPage,
});

const authLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: LoginPage,
});

const routeTree = rootRoute.addChildren([indexRoute, todayRoute, authLoginRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// M6 マイルストーンで実コンポーネントに置き換える。
function TodayPage(): React.ReactElement {
  return (
    <section className="p-6 space-y-3">
      <h1 className="text-2xl font-bold text-game-accent">今日のタスク</h1>
      <p className="text-sm">M6 マイルストーンで時間帯別タスクリストに置き換える。</p>
    </section>
  );
}

// M3 マイルストーンで実コンポーネントに置き換える。
function LoginPage(): React.ReactElement {
  return (
    <section className="p-6 space-y-3 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-game-accent">ログイン</h1>
      <p className="text-sm">
        M3 マイルストーンで Supabase Email/Password 認証フォームを実装する。
      </p>
    </section>
  );
}
```

- [ ] **Step 2: src/App.tsx を Router プロバイダに置き換える**

```tsx
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router.tsx';

export default function App(): React.ReactElement {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 3: src/App.test.tsx を書き換える（リダイレクトとプレースホルダ表示の確認）**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';
import { router } from './router.tsx';

async function navigate(path: string): Promise<void> {
  await router.navigate({ to: path });
}

describe('App ルーティング', () => {
  it('/today で「今日のタスク」ページが表示される', async () => {
    await navigate('/today');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '今日のタスク' })).toBeInTheDocument();
    });
  });

  it('/auth/login で「ログイン」ページが表示される', async () => {
    await navigate('/auth/login');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument();
    });
  });

  it('/ から /today へリダイレクトされる', async () => {
    await navigate('/');
    render(<App />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/today');
    });
  });
});
```

- [ ] **Step 4: typecheck / test / lint がパスすることを確認**

```bash
CI=true pnpm nx run @org/habits:typecheck
CI=true pnpm nx run @org/habits:test
pnpm exec biome ci apps/habits/
```

Expected: すべて緑。test では 3 テストが pass。

- [ ] **Step 5: dev サーバーで `/`, `/today`, `/auth/login` を確認（手動）**

```bash
pnpm nx serve habits
```

Expected:
- `http://localhost:5173/` → `/today` にリダイレクトされ「今日のタスク」が表示
- `http://localhost:5173/today` → 同上
- `http://localhost:5173/auth/login` → 「ログイン」が表示

`Ctrl+C` で停止。

- [ ] **Step 6: コミット**

```bash
git add apps/habits
git commit -m "$(cat <<'EOF'
feat(habits): TanStack Router で / /today /auth/login のルート骨格を追加

- / は /today へリダイレクト
- /today, /auth/login はプレースホルダ（M3 / M6 で実装）
- App.tsx を RouterProvider に置き換え、testing-library で3ケースのスモーク確認

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: M1 全体の動作検証

**目的:** Nx グラフ・全 typecheck / test / lint・dev サーバー起動を最終確認し、M1 完了マーカーとして本プランの完了報告を行う。

**Files:** （変更なし、検証のみ）

- [ ] **Step 1: Nx affected で全プロジェクトの typecheck / lint / test を実行**

```bash
CI=true pnpm nx run-many -t typecheck lint test
```

Expected: 全プロジェクト緑。`@org/habits`, `@org/habit-core`, `@org/habit-sync`, `@org/ui`, `@org/config-*` がすべて成功。

- [ ] **Step 2: Nx 依存グラフを生成して目視確認**

```bash
pnpm nx graph --file=tmp/nx-graph.html
```

Expected: `tmp/nx-graph.html` が生成される。ファイルをブラウザで開くか、CLI で確認:

```bash
pnpm nx graph --print
```

確認項目（CLI 出力または HTML で目視）:
- `@org/habits` が `@org/habit-core`, `@org/habit-sync`, `@org/ui` に依存
- `@org/habit-sync` が `@org/habit-core` に依存
- `@org/habit-core` が他の workspace パッケージに依存していない
- 循環依存なし

- [ ] **Step 3: dev サーバー起動を最終確認**

```bash
pnpm nx serve habits
```

`http://localhost:5173/today` と `http://localhost:5173/auth/login` がブラウザで開けることを確認し、`Ctrl+C` で停止。

- [ ] **Step 4: M1 完了の git log を確認**

```bash
git log --oneline -10
```

Expected: 直近に以下相当のコミットが並ぶ:
- `feat(habits): TanStack Router で / /today /auth/login のルート骨格を追加`
- `feat(habits): Vite + React + Tailwind v4 でアプリ雛形を作成`
- `feat(habit-sync): legend-state + Supabase 同期層の雛形パッケージを追加`
- `feat(habit-core): 純粋ドメインの雛形パッケージを追加`
- `chore: pnpm-workspace.yaml の catalog に habits 用依存を追加`
- `chore: sample-game / audio / game-core を撤去し habits アプリ方針に書き換え`

- [ ] **Step 5: README の更新が反映されていることを確認**

```bash
grep -c "sample-game" README.md
```

Expected: `0`（sample-game の記述が完全に消えている）。

- [ ] **Step 6: M1 完了報告**

このプランの全タスクが完了したことを報告し、次のマイルストーン M2（Supabase 基盤）のプラン作成が必要であることを伝える。コミットは Step 4 までで既に完了しているため、追加コミットは不要。

---

## 次のマイルストーン

このプラン完了後、`docs/superpowers/plans/2026-05-16-habits-app-m2-supabase.md` を新規に作成し、以下を扱う:

- `supabase init` でローカルワークスペース作成
- 設計仕様 §5.1 / §5.2 のテーブル・型・JSON スキーマを 11 個のマイグレーションに分割実装
- `is_due_on()` SQL 関数（§5.3）
- `task_stash_view`（§5.3）
- トリガー（§5.4）と Realtime publication（§5.4）
- 初期データ自動生成トリガー（§5.5）
- Supabase TS 型生成（`supabase gen types typescript`）を `packages/habit-sync` に取り込み
