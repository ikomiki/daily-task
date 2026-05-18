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

### 同期レイヤー（M5 以降）

- `packages/habit-sync` の `state$` が legend-state + syncedSupabase で双方向同期
- 永続化は IndexedDB (`habits-cache` データベース)。オフライン書き込みは retry queue に滞留 → 復帰時に自動再送
- `task_logs` は初期ロード時に直近 31 日のみ取得（32 日以前は M9 で実装済みの遅延ロードで取得）
- `task_stash_view` は read-only（書き込みはトリガー経由）
- `useTodayTasks(today)` で今日のタスクビューを購読、`getPendingSyncCount(state$)` で pending 件数を取得
- `online$` で `navigator.onLine` を observable 化

### Today 画面（M6 以降）

- `apps/habits/src/features/today/` 配下に `Today` / `TodayView` / `TimeSlotGroup` / `TodayTaskItem` / `StatusButtons` を実装
- 3 ボタン（完了 / スキップ / 失敗）で `state$.task_logs['${task_id}-${today}']` を楽観更新
- 同じ button を再度押すと empty（行削除）に戻る、別 button で切り替え
- 書き込みヘルパー: `@org/habit-sync` の `setTaskLogStatus(taskId, date, status)` / `clearTaskLogStatus(taskId, date)`
- `today` 文字列は `apps/habits/src/lib/today-date.ts` の `getTodayDateString()` で生成

### タスク管理 / 時間帯設定（M7 以降）

- `/tasks`: TaskList で全タスクを一覧表示、新規追加 / 編集 / アーカイブ / 復元
- `/tasks/new` / `/tasks/$id`: TaskForm で新規・編集（FrequencyPicker 内包）
- `/settings/time-slots`: 時間帯の CRUD。最低 1 個と参照タスクなしのガードあり
- 書き込みヘルパー: `@org/habit-sync` の `createTask` / `updateTask` / `archiveTask` / `unarchiveTask` / `createTimeSlot` / `updateTimeSlot` / `deleteTimeSlot`
- 頻度サマリ表示: `apps/habits/src/lib/frequency-format.ts` の `formatFrequency`
- 全認証ルートは `router.tsx` 内の `requireAuth()` 共通 beforeLoad で AuthGate を共有

### スタッシュ（集計表示）/ オフライン可視化（M8 以降）

- `/stash`: 全アクティブタスクの集計（完了数 / スキップ / 失敗 / 連続 / 対象日数 / 完了率 / 最終完了日）を一覧
- `apps/habits/src/features/stash/` 配下に `PendingSyncBadge` / `StashRow` / `StashPanel` を実装
- `state$.task_stash_view`（VIEW、read-only）を購読、`state$.tasks` と join して時間帯 / sort_order 順
- `PendingSyncBadge`: `online$ === false` または `getPendingSyncCount(state$) >= 1` のとき表示。両方を同時に併記
- React フック: `useOnlineStatus` / `usePendingSyncCount` / `useTaskStashList` を `apps/habits/src/hooks/` に追加
- フォーマッタ: `apps/habits/src/lib/stash-format.ts` の `formatStashCount` / `formatCompletionRate` / `formatLastCompletedDate`（null セーフ）
- Today 画面のヘッダー nav から `/stash` へ遷移可能

### 履歴画面 / 過去ログ遅延取得（M9 以降）

- `/history`: 選択中タスクの履歴ログ（date 降順）を遅延ロード式に表示
- `apps/habits/src/features/history/HistoryView.tsx` がタスク選択 + ログ一覧 + 「もっと読み込む」を統合
- 直近 31 日: `state$.task_logs` から該当 task の log を抽出
- 32 日以前: `loadTaskHistory(client, { taskId, beforeDate, limit })` で Supabase からオンデマンド取得（既定 31 件/回）
- 過去ログは `state$` には保存せず、`useTaskHistory(taskId)` フックがローカル state で保持
- ステータスラベル: `apps/habits/src/lib/history-status.ts` の `formatHistoryStatus('complete' | 'skip' | 'fail')`
- 取得結果がページサイズ未満なら hasMore=false に切り替わり「これ以上履歴はありません」表示
- Today 画面のヘッダー nav から `/history` へ遷移可能（アーカイブ済タスクも選択肢に出る）

### カレンダー画面

- `/calendar`: 選択中タスクの月別 7×6 グリッド（日曜始まり）を表示し、過去日を 4 状態循環で編集可能
- `apps/habits/src/features/calendar/CalendarView.tsx` が CalendarHeader（タスク select + 月遷移）+ CalendarGrid（曜日見出し + 42 セル）を統合
- `apps/habits/src/hooks/useTaskCalendar.ts` が月切替 / `state$.task_logs`（直近 31 日）+ 月単位ローカルキャッシュ（32 日以前）を統合
- 月単位 fetch: `apps/habits/src/lib/calendar-fetch-range.ts` の `loadTaskLogsInRange` が `loadTaskHistory` をラップ
- 状態循環: `apps/habits/src/lib/calendar-status.ts` の `nextCalendarStatus`（empty → complete → fail → skip → empty）
- 日付グリッドユーティリティ: `packages/habit-core/src/month-grid.ts` の `buildCalendarGrid('YYYY-MM')` が 42 セル配列を返す
- セルの編集制約: 未来日と `isDueOn=false` の日は disabled。書込後は `refreshTaskStashView()` を呼び集計を更新
- 31 日 cutoff 外（過去月）への書込は monthCache に同期 merge し、同セッション中の再描画を安定化
- Today 画面のヘッダー nav から `/calendar` へ遷移可能（並び: タスク管理 / スタッシュ / カレンダー / 履歴 / 設定）
- 配色トークン（`packages/config-tailwind/src/theme.css`）: `--color-cal-complete` / `cal-fail` / `cal-skip` / `cal-today` / `cal-dim`

### 通知 v1 / フォアグラウンドスケジューラ（M10 以降）

- `/settings/notifications`: 権限の現在値表示 + 「通知を許可する」ボタン
- `packages/habit-sync/src/notify/WebNotificationProvider.ts` がブラウザ Notification API + setTimeout の v1 実装
- `apps/habits/src/features/notify/NotificationManager.tsx` が `state$.time_slots` を購読し、各 slot の `notify_at` 時刻に `setTimeout` を予約
- スロット時刻に発火すると `getSlotPendingNotificationTasks` で当日の未操作（status='empty'）タスクを抽出し、件数 > 0 のとき `provider.show(slot.name, "X 件未完了")` 通知
- `useNotificationPermission()` で `Notification.permission` を React state 化（'default' は 'prompt' に正規化、API 無しは 'unsupported'）
- `WebNotificationProvider` は `{ now: () => Date }` で時計を DI 可能（fake timers テスト用）
- スコープ外: 日跨ぎ自動再スケジュール（v1 は当日中のみ）、Service Worker / Web Push、タスク単位通知

### PWA 化 / Service Worker（M11 以降）

- `vite-plugin-pwa` (catalog: ^1.0.0) を `apps/habits/vite.config.ts` で有効化、Workbox ベースで SW + manifest を自動生成
- `registerType: 'autoUpdate'` — 新バージョン検知で自動更新（リフレッシュ不要）
- マニフェスト: `name: Habits`, `display: standalone`, `theme_color: #0f172a`, `lang: ja`
- アイコン: `apps/habits/public/{icon-192,icon-512,icon-maskable,favicon}.svg`（SVG 統一、iOS は apple-touch-icon を `icon-192.svg` で参照）
- `apps/habits/src/lib/pwa-register.ts` が `virtual:pwa-register` を動的 import するラッパー（vitest 環境では catch で握り潰される）
- ビルド成果物: `dist/manifest.webmanifest` / `dist/sw.js`（`autoUpdate` モードでは `registerSW.js` は生成されず、`dist/assets/virtual_pwa-register-*.js` にバンドルされる）
- `workbox.globPatterns` で JS/CSS/HTML/SVG/woff2 をプリキャッシュ、`navigateFallbackDenylist` で `/api` と `/auth` を除外
- `devOptions.enabled = false` — 開発ビルドでは SW を出さない（HMR 阻害回避）
- スコープ外: Web Push（v1.5）、カスタム SW (injectManifest)、インストールプロンプト UI、スプラッシュ画像、PNG 版 apple-touch-icon（iOS Safari の SVG 互換性向上時に再検討）

### Claude Design プロトタイプ適用（M14 以降）

M14 では Claude Design (claude.ai/design) で生成したハイファイプロトタイプを本番アプリに適用した。**視覚要素のみ移植**し、データフロー・ルーター・Supabase 同期層は触らない。

- **新規トークン** (`packages/config-tailwind/src/theme.css` `@theme {}`)
  - fg shades: `--color-game-fg-muted` / `--color-game-fg-dim` / `--color-game-accent-soft`
  - surfaces: `--color-surface-1` (#11141b) / `--color-surface-2` (#161a23) / `--color-surface-3` (#1b202b)
  - borders: `--color-border-default` (#2a2f3a) / `--color-border-strong` (#3a4252)
  - status: `--color-status-complete` (#16a34a) / `--color-status-skip` (#ca8a04) / `--color-status-fail` (#dc2626)
  - radius: `--radius-sm/md/lg/full` (4/6/10/999px)
  - mono font: `--font-mono` ("JetBrains Mono", ui-monospace, ...)
  - `@utility page-fade` / `@utility animate-pulse-dot` を `config-tailwind` に移動し library-app 間の CSS 依存を解消
- **フォント同梱**: `@fontsource/inter` + `@fontsource/jetbrains-mono` (latin subset のみ) を `apps/habits/src/styles.css` で import
- **`@source` ディレクティブ**: `styles.css` に `@source "../../../packages/ui/src"` を追加し Tailwind v4 が `@org/ui` クラスを確実に生成
- **新規 `@org/ui` コンポーネント 3 種**: `TopBar` (sticky brand header) / `Banner` (warning/info with pulse dot) / `EmptyState` (flat card)
- **`@org/ui` 改修**: `Button` variant/size/block / `Card` tone / `PageContainer` max-w / `PageHeader` subtitle+right (nav prop 撤去) / `AppNav` currentPath+isNavItemActive / `TextInput` / `SelectInput` (chevron) / `AlertText`
- **グローバル TopBar**: `router.tsx` の rootRoute で auth 以外に常時マウント
- **`RoutedAppNav`** (`apps/habits/src/components/RoutedAppNav.tsx`): `useRouterState` で currentPath 自動注入 + signOut 集約。nav 順: 今日 / タスク / カレンダー / 履歴 / スタッシュ / 設定
- **全 10 画面の視覚再描画**: Auth / Today / Tasks / Task-edit / Time-slots / Settings / Stash / History / Calendar
- スコープ外: `PendingSyncBadge` の pendingCount 併記 (別 PR) / Storybook / Lighthouse CI / ライトモード / ネイティブ移行

### Claude Design プロンプト + UI ブラッシュアップ（M13 以降）

- `docs/design-prompts/` 配下に README + 10 画面の Claude Design プロンプトを配置
  - 各画面の共通章立て: 目的 / 表示要素 / インタラクション / 状態 / レスポンシブ / アクセシビリティ / 既存スタイル参照
  - 整合性は `apps/habits/src/design-prompts.test.ts` のスモークテストで担保
- `@org/ui` に共通コンポーネント 8 種を導入（M1 時点の空殻からの本格投入）
  - `Button` / `Card` / `PageContainer` / `PageHeader` / `TextInput` / `SelectInput` / `AlertText` / `AppNav`
  - `AppNav` は `linkComponent` prop でルーター依存を切り出し、`packages/ui` を router 非依存に保つ
  - `apps/habits` の全 features / routes を共通コンポーネントへ置き換え済み
- `theme_color` / `background_color` を `--color-game-bg` (`#0b0d12`) に揃え、manifest と CSS トークンを一元化
- Lighthouse 検証は手動運用（CI 化なし）: `docs/ops-guide.md` の手順に従い `pnpm nx build habits` + `vite preview` 後に `lighthouse` CLI を実行
  - 数値目標: Performance ≥ 90 / Accessibility ≥ 95 / Best Practices ≥ 95 / SEO ≥ 90 / PWA Installable PASS
- スコープ外: Storybook 化、Visual Regression、Lighthouse CI、semantic token 拡張、PNG icon 自動生成パイプライン

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
