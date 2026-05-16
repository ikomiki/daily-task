# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## このリポジトリの目的

毎日の習慣タスクを管理する Web アプリ（habits）を開発する Nx モノレポ基盤。
`apps/habits` が Web アプリ本体、`packages/*` がドメインロジック・同期層・共有設定。
長期的には Tauri v2 で PC / モバイルネイティブアプリへ拡張する。

設計仕様: `docs/superpowers/specs/2026-05-16-habits-app-design.md`

## 主要コマンド

すべての検証は `CI=true` を付けるか CI 環境で実行すること。
ローカル対話では `@nx/js/typescript` の sync 警告で `nx run-many` がブロックされる。

```bash
pnpm install                                      # 依存解決（postinstall許可は pnpm-workspace.yaml の allowBuilds で管理）
CI=true pnpm nx run-many -t typecheck             # 全パッケージの型検査
CI=true pnpm nx run-many -t test                  # 全パッケージの vitest
CI=true pnpm nx affected -t typecheck test        # PR 影響範囲のみ
pnpm nx test <project-name>                       # 単一プロジェクトの vitest
pnpm nx test <project> -- -t "テスト名"            # 単一テスト実行（vitest の -t 引数）
pnpm nx serve habits                              # Vite dev server (5173)
pnpm nx build habits                              # Vite production build
pnpm nx e2e habits                                # Playwright E2E (M12 で本格利用)
pnpm exec biome ci .                              # format + lint チェック (CI と同じ)
pnpm exec biome check --write .                   # format + lint 自動修正
pnpm nx graph                                     # 依存グラフを HTML で開く
# Supabase（ローカル開発）
supabase start                                    # Docker でローカル環境起動（API:54321, DB:54322, Studio:54323）
supabase stop                                     # 停止
supabase db reset                                 # DB 完全リセットして全マイグレーション再適用
supabase migration new <name>                     # 新規マイグレーションファイル作成（タイムスタンプ自動付与）
supabase gen types typescript --local --schema public > packages/habit-sync/src/db-types.ts  # 型生成
```

## アーキテクチャ要点

### 依存方向（一方向のみ）

```
apps/habits → packages/{habit-sync, habit-core, ui} → packages/config-*
packages/habit-sync → packages/habit-core
packages/ui → packages/habit-core （型のみ参照）
```

- `packages/habit-core` は他の packages に依存しない（純粋ドメイン: 頻度評価 / streak / status）
- `packages/habit-sync` は legend-state + Supabase の同期層。`habit-core` の型のみ参照
- 双方向依存・循環依存は Nx グラフで検出して落とす

### workspace package の解決方式

- 各パッケージの `package.json` の `exports` は `@org/source` カスタム条件で `.ts` ソースを直接公開
- `packages/config-tsconfig/base.json` の `customConditions: ["@org/source"]` で TS が source 解決する
- このため **TypeScript project references は使わない**（nx-sync が追加するが、実行に影響しないよう nx.json で applyChanges: false に設定）

### tsconfig は2層構成

各 `apps/<name>/` と `packages/<name>/` には次の2つを置く:

- `tsconfig.json` — LSP/IDE 用。`noEmit: true`、テスト/configファイルも `include`、composite なし
- `tsconfig.lib.json`（lib）または `tsconfig.app.json`（app） — ビルド用。テストを `exclude`、composite + declaration（lib のみ）

詳細は `packages/habit-core/` を参照実装として見ること。

### 共有設定（packages/config-*）

- `config-biome` — `biome.json` を共有。`extends: ["@org/config-biome/biome.json"]` で各パッケージが薄く参照
- `config-tsconfig` — `base.json` / `lib.json` / `app.json` の3層
- `config-tailwind` — Tailwind v4 CSS-first（`theme.css` の `@theme` ブロック）
- `config-vitest` — `node` / `react` / `pixi` の3 preset。preset 内では相対 import を使わずインライン展開

## pnpm workspace 固有の注意

- 全依存バージョンは `pnpm-workspace.yaml` の `catalog:` で単一ソース化。各 `package.json` は `"react": "catalog:"` のように参照する
- pnpm 11+ は postinstall を既定でブロックするため、`allowBuilds: { name: true }` で明示許可（`esbuild`, `@swc/core`, `nx`）
- ネイティブビルド系の依存を新たに増やしたら `allowBuilds` を更新
- 公開直後のパッケージは `minimumReleaseAge: 4320`（3日）で cooldown する。緊急ホットフィックスが必要な場合のみ `minimumReleaseAgeExclude` に `name@version` を追加して個別解除する

## Claude 統合

- `.claude/hooks/biome-format.mjs` — `Edit/Write/MultiEdit` 直後に対象ファイルだけ Biome format（PostToolUse）
- `.claude/hooks/pre-commit-gate.mjs` — `git commit` 直前に `pnpm nx affected -t lint test` を実行（PreToolUse、失敗で commit ブロック、`--no-verify` で素通し）
- `.claude/commands/{lint,test,format}.md` — サブエージェント駆動のスラッシュコマンド

## コード規約

- `any` は原則として使用しない（Biome `noExplicitAny` で error）
- if 文に続く制御ブロックは1行でも必ず `{}` で囲う（Biome `useBlockStatements` で error）
- コードコメントは日本語で記述する
- コミット前に `pnpm nx affected -t lint test` がグリーンであること（pre-commit-gate hook が自動検査）

## 失敗時の自動記録

タスクが失敗・誤りだった場合、以下を必ず実行する:

1. 失敗の原因を簡潔に分析する
2. 適切な場所に記録する:
   - プロジェクト固有 → `memory/YYYY-MM-DD-<topic>.md`
   - 汎用パターン → `rules/<rule-name>.md`
3. 同じ失敗が `memory/` に2回以上記録されている場合は、`rules/` に昇格させる

詳細: `memory/README.md`, `rules/README.md`

## Supabase ローカル開発

- 起動には Docker Desktop が必要（macOS）
- `supabase start` の出力に表示される `anon key` を `apps/habits/.env.local` に転記する（`.env.local.example` 参照）
- マイグレーションは `supabase/migrations/YYYYMMDDHHMMSS_<name>.sql` の順序で適用される
- スキーマ変更後は `supabase db reset` で完全再適用し、`supabase gen types ...` で TS 型を更新
- RLS は全テーブルで有効。本人 (`auth.uid() = user_id`) のみ操作可
- 集計（task_stash）はトリガー駆動。task_stash_view が task_days / completion_rate を補完
- 詳細は `docs/superpowers/specs/2026-05-16-habits-app-design.md` §5 / §8

### 認証フロー（M3 以降）

- ローカル `.env.local` の `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を `supabase start` 出力から転記
- `/auth/signup` で新規登録 → Email 確認は dev で OFF のため即セッション → `/today` 着地
- 初期データ（6 タスク + 2 時間帯）は `auth.users` INSERT トリガーで自動生成
- セッションは localStorage に保存され、`useAuthSession` の `onAuthStateChange` 経由で `state$.user` に反映される
- 未認証で `/today` にアクセスすると `beforeLoad` AuthGate により `/auth/login` にリダイレクト

## E2E（Playwright）

ローカル E2E は `.nvmrc` の Node v24.15.0 で動作確認済み。
**Node v26 系を使うと `playwright install chromium` のダウンロードが停止する**ため、
`source ~/.nvm/nvm.sh && nvm use` を必ず通してから `pnpm nx e2e <app>` する。
詳細: `memory/2026-05-10-playwright-chromium-install-stuck.md`。
CI（`.github/workflows/ci.yml` の `--with-deps`）では Node 24 系で問題なく動作する。

## Superpowers 運用

設計→プラン→実装→レビューのワークフローは `superpowers:*` スキルで進める:

- `superpowers:brainstorming` — 仕様策定（`docs/superpowers/specs/` に保存）
- `superpowers:writing-plans` — 実装プラン（`docs/superpowers/plans/` に保存）
- `superpowers:subagent-driven-development` — 1タスク=1サブエージェント+spec/quality 2段レビュー
- `superpowers:test-driven-development` — Red→Green→Refactor

## Nx 関連の運用上の罠

- `pnpm nx run-many` は対話環境で sync 警告でブロックされる → `CI=true` を付けるか `nx.json` の `sync.applyChanges: true` を設定
- `@nx/js/typescript` プラグインは libs に `build` ターゲットを自動推論しない場合がある（dist 不要なら無視可、必要なら project.json で明示）
