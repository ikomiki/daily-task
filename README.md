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
