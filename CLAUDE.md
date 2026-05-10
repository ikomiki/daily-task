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

## コード規約

- `any` は原則として使用しない（Biome `noExplicitAny` で error）
- if 文に続く制御ブロックは1行でも必ず `{}` で囲う（Biome `useBlockStatements` で error）
- コードコメントは日本語で記述する
- コミット前に `pnpm nx affected -t lint test` がグリーンであること
  （`.claude/hooks/pre-commit-gate.mjs` が自動検査）

## 失敗時の自動記録

タスクが失敗・誤りだった場合、以下を必ず実行する:

1. 失敗の原因を簡潔に分析する
2. 適切な場所に記録する:
   - プロジェクト固有 → `memory/YYYY-MM-DD-<topic>.md`
   - 汎用パターン → `rules/<rule-name>.md`
3. 同じ失敗が `memory/` に2回以上記録されている場合は、`rules/` に昇格させる

詳細: `memory/README.md`, `rules/README.md`

## ディレクトリ構造の慣例

- `apps/<name>/` と `packages/<name>/` には `tsconfig.json` (LSP用、noEmit、テスト含む)
  と `tsconfig.lib.json` (またはアプリは `tsconfig.app.json`、ビルド用、テスト除外)
  の2層構成を置く（Task 7 game-core が参照実装）
- 共有設定は `packages/config-{biome,tsconfig,tailwind,vitest}/` に集約
- 依存方向: `apps/*` → `packages/{ui,game-core,audio}` → `packages/config-*`
