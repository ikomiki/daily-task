# daily-task

毎日の習慣タスクを管理する Web アプリを開発する Nx モノレポ。
Vite + React 19 + Tailwind CSS v4 + TanStack Router + legend-state + Supabase を共通基盤として、
`apps/habits` に Web アプリ本体、`packages/*` にドメインロジック・同期層・共有設定を集める。

## クイックスタート

```bash
# 1. 依存インストール
pnpm install

# 2. ローカル Supabase 起動（Docker Desktop が必要）
supabase start

# 3. 環境変数設定（supabase start 出力の API URL / anon key をコピー）
cp apps/habits/.env.local.example apps/habits/.env.local
# → VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を転記

# 4. 開発サーバー起動
pnpm nx serve habits        # http://localhost:5173 で起動
```

## ディレクトリ

```
apps/
  habits/             Web SPA（Vite + React + Tailwind + TanStack Router + PWA）
    src/
      features/       画面コンポーネント（today, stash, history, notify, task, timeslot, auth）
      routes/         ページコンポーネント（tasks, settings, stash, history）
      hooks/          React カスタムフック
      lib/            ユーティリティ（auth, supabase, formatters, pwa-register）
    public/           PWA アイコン（favicon, icon-192, icon-512, icon-maskable）
packages/
  habit-core/         純粋ドメイン（頻度評価 / streak / status 型）
  habit-sync/         legend-state + Supabase 同期層、IndexedDB 永続化、通知プロバイダー
  ui/                 React + Tailwind の共有 UI（将来拡張用）
  config-biome/       共有 biome.json
  config-tsconfig/    base / lib / app の 3 層 tsconfig
  config-tailwind/    Tailwind v4 の @theme プリセット
  config-vitest/      vitest の node / react プリセット
supabase/
  migrations/         DB マイグレーション（11 ファイル、profiles〜realtime）
.claude/              Claude Code の hooks / commands / settings
.github/workflows/    GitHub Actions CI
docs/superpowers/     設計書（specs/）と実装プラン（plans/ M1〜M11）
memory/, rules/       失敗事例ログとルール
```

依存方向は `apps/habits → packages/{habit-sync, habit-core, ui} → packages/config-*` の一方向のみ。

## 実装済み画面

| パス | 機能 |
| ---- | ---- |
| `/today` | 今日のタスク一覧（完了/スキップ/失敗 の3ボタン切り替え） |
| `/tasks` | タスク一覧・新規追加・編集・アーカイブ・復元 |
| `/tasks/new` | タスク新規作成（FrequencyPicker 内包） |
| `/tasks/$id` | タスク編集 |
| `/stash` | 全タスクの集計（完了数/連続/完了率/最終完了日） + オフライン可視化 |
| `/history` | タスク別ログ履歴（直近 31 日 + 遅延ロードで過去分） |
| `/settings/time-slots` | 時間帯 CRUD |
| `/settings/notifications` | 通知権限管理 + フォアグラウンドスケジューラー設定 |
| `/auth/login` | ログイン |
| `/auth/signup` | サインアップ（Email 確認はローカルで OFF） |

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
| ルーティング         | TanStack Router 1.x（code-based）                               |
| 状態管理 / 同期      | legend-state 3.x beta + `@legendapp/state/sync-plugins/supabase` |
| バックエンド         | Supabase（ローカル Docker、RLS + リアルタイム）                 |
| バリデーション       | Zod 4                                                           |
| PWA                  | vite-plugin-pwa 1.x + Workbox（autoUpdate、manifest、SVG アイコン）|

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
