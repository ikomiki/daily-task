# Habits App 設計仕様

作成日: 2026-05-16
ステータス: 設計承認済み（ブレインストーミング完了）

## 1. 背景と目的

毎日の習慣タスクを管理する Web アプリを Nx モノレポに新規構築する。既存の `sample-game` 関連パッケージ（`apps/sample-game`, `packages/audio`, `packages/game-core`, `packages/ui` の中身）は削除済みで、`apps/` は空、`packages/config-*` のみが残存している状態から始まる。

ユーザー個人の習慣形成を継続的に支援することが目的。Web から始めて、長期的には Tauri v2 で PC/モバイルネイティブアプリへ展開する。

## 2. 要件サマリ

| 項目 | 内容 |
|---|---|
| 状態管理 | legend-state + Supabase（ローカル開発: Docker + supabase CLI） |
| 対応端末 | PC / スマートフォン（レスポンシブ） |
| プラットフォーム | v1: Web SPA / 長期: Tauri v2 |
| 認証 | v1: Supabase Email/Password / 長期: SNS ログイン |
| タスクの属性 | 名前、頻度ルール、時間帯、状態履歴、連続完了数（streak） |
| 状態 | 未入力 / 完了 / スキップ（祝日等）/ 失敗（1 タスク 1 回 boolean） |
| 頻度 | 毎日 / n 日に 1 回 / 曜日（第 n 週指定可）/ n 週に 1 回 |
| 時間帯 | 可変リスト、最低 1 個は残す、時間帯ごとに通知時刻を持つ |
| streak | 完了 = +1、スキップ = 維持、失敗 = 0、頻度外 = 無視 |
| 集計 (stash) | Supabase トリガー + VIEW。完了回数 / タスク日数 / 完了割合 |
| オフライン | 書き込みキャッシュ、同期前メッセージ |
| 通知 | v1: フォアグラウンド、設計上 browser/Tauri 切替可能な抽象を担保 |
| 過去ログ | 直近 31 日を購読、それ以前は履歴画面で遅延ロード |
| デザイン | Claude Design 向けプロンプトを Markdown で出力 |

## 3. アーキテクチャ（Approach A: Pure SPA + PWA + Supabase）

- フロント: Vite + React + TanStack Router + Tailwind v4
- 状態: legend-state + `@legendapp/state/sync-plugins/supabase`
- 永続化: legend-state IndexedDB プラグイン（書き込みキュー）
- PWA: `vite-plugin-pwa` + Service Worker
- バックエンド: Supabase（PostgreSQL + Auth + Realtime + RLS）、ローカルは Docker
- Tauri v2 は将来、Vite ビルドをそのまま被せる形で対応

## 4. モノレポ配置

```
apps/
  habits/                  新規: Web SPA
packages/
  habit-core/              新規: 純粋ドメイン（頻度評価 / streak / status）
  habit-sync/              新規: legend-state + Supabase 同期層
  ui/                      既存空洞 → アプリの UI 共有部品で再活用
  config-biome/            維持
  config-tsconfig/         維持
  config-tailwind/         維持（トークン追記）
  config-vitest/           維持
supabase/                  新規: ローカル Supabase ワークスペース
docs/
  design-prompts/          新規: Claude Design 向け画面プロンプト
  superpowers/specs/       本ドキュメント置き場
```

依存方向（一方向）:

```
apps/habits → packages/{habit-sync, habit-core, ui} → packages/config-*
packages/habit-sync → packages/habit-core
packages/ui → packages/habit-core（型のみ参照）
```

## 5. データモデル（Supabase スキーマ）

### 5.1 テーブル

```sql
profiles(
  id uuid PK FK auth.users,
  created_at, updated_at
)

time_slots(
  id uuid PK, user_id uuid FK auth.users,
  name text,                          -- 朝、夜...
  notify_at time,                     -- HH:MM:SS（ユーザーローカル）
  sort_order int,
  created_at, updated_at
)

tasks(
  id uuid PK, user_id uuid FK,
  time_slot_id uuid FK time_slots,
  name text,
  frequency jsonb,                    -- 頻度ルール（5.2 参照）
  sort_order int, archived_at timestamptz,
  created_at,                         -- "タスク追加日付"
  updated_at
)

task_logs(
  task_id uuid FK tasks, date date,
  status enum('complete','skip','fail'),
  created_at, updated_at,
  PRIMARY KEY (task_id, date)
)
-- INDEX (task_id, date desc) — streak 計算用

task_stash(
  task_id uuid PK FK tasks,
  complete_count int, fail_count int, skip_count int,
  current_streak int,                 -- スキップ=維持、失敗=0
  last_completed_date date,
  updated_at
)
```

`status = 'empty'` はDBに行が存在しない状態で表現する（疎な保存）。

### 5.2 頻度ルール JSON スキーマ

```ts
type Frequency =
  | { type: "daily" }
  | { type: "every_n_days"; n: number; anchor: "YYYY-MM-DD" }
  | { type: "weekday"; days: number[] }                                  // 1=月..7=日
  | { type: "day_of_week"; days: number[]; weeks_of_month?: number[] }  // 第 n 週指定可
  | { type: "every_n_weeks"; n: number; day_of_week: number; anchor: "YYYY-MM-DD" };
```

評価関数の二重実装:

- TS: `packages/habit-core/src/frequency.ts` の `isDueOn(rule, date, taskCreatedAt)`（純粋関数）
- SQL: `is_due_on(rule jsonb, date date, anchor date) returns boolean`（VIEW から呼ぶ）

両者は同じ判定ロジックを返すこと（テストで保証）。

### 5.3 集計（stash）戦略

`task_logs` のイベントで更新できる項目はトリガー駆動、時間経過に依存する項目はVIEWで読み取り時計算するハイブリッド方式:

- トリガー駆動（`task_logs` AFTER INSERT/UPDATE/DELETE）
  - `complete_count` / `fail_count` / `skip_count`
  - `current_streak`（log を時系列で走査して再計算: 失敗で 0、スキップで維持）
  - `last_completed_date`
- 読み取り時計算（`task_stash_view`）
  - `task_days = (tasks.created_at から CURRENT_DATE までで is_due_on(date) が真の日数) - skip_count`
  - `completion_rate = complete_count / NULLIF(task_days, 0)`
  - 今日が頻度マッチかつ未操作の場合も `task_days` に含める（時間経過で自然に減少しない実装、シンプル優先）

アプリ側は `task_stash_view` を購読する（`task_stash` テーブル自体は購読不要）。

### 5.4 RLS / Realtime

- 全テーブルに `auth.uid() = user_id` の RLS ポリシー（INSERT/SELECT/UPDATE/DELETE 全面）
- `tasks` / `time_slots` / `task_logs` / `task_stash` を `supabase_realtime` publication に追加
- `auth.users` AFTER INSERT トリガーで `profiles` + 初期時間帯 2 件 + 初期タスク 6 件を自動生成

### 5.5 初期データ（サインアップ時自動生成）

| 時間帯 | 既定時刻 | タスク | 頻度 |
|---|---|---|---|
| 朝 | 07:00 | 歯を磨く | 毎日 |
| 朝 | 07:00 | メールを確認する | 平日 |
| 朝 | 07:00 | 今日のタスクを見直す | 平日 |
| 朝 | 07:00 | 不燃物のゴミ捨て | 第 2/第 4 木曜 |
| 夜 | 21:00（既定）| 運動する | 3 日に 1 回 |
| 夜 | 21:00（既定）| 掃除する | 2 週に 1 回 土曜（既定）|

夜の時刻と掃除の曜日はユーザー仕様で未指定だったため合理的デフォルトを採用、UI で編集可能。

## 6. フロントエンドアーキテクチャ

### 6.1 同期レイヤー（`packages/habit-sync`）

```ts
const state$ = observable({
  user: ...,
  time_slots: syncedSupabase({ collection: "time_slots", realtime: true, ... }),
  tasks:      syncedSupabase({ collection: "tasks",       realtime: true, ... }),
  task_logs:  syncedSupabase({
    collection: "task_logs", realtime: true,
    filter: (q) => q.gte("date", today.minusDays(31))  // 直近 31 日
  }),
  task_stash_view: syncedSupabase({ collection: "task_stash_view", readonly: true }),
});

configureSynced(state$, {
  persist: { plugin: ObservablePersistIndexedDB, name: "habits-cache" },
  retry:   { infinite: true, delay: 1000, backoff: "exponential" }
});
```

- 書き込みは optimistic → 失敗時は IndexedDB に永続キュー
- 履歴画面（32 日以前）は別 observable で遅延ロード
- `usePendingSyncCount()` で legend-state の retry queue 件数を購読

### 6.2 アプリ構成（`apps/habits/src/`）

```
main.tsx                  entry + Service Worker register
App.tsx                   AuthGate + ルーティング
lib/{supabase,auth}.ts
routes/
  auth/{Login,Signup}.tsx
  today/Today.tsx                 メイン: 時間帯ごとに今日のタスク
  tasks/{TaskList,TaskEdit}.tsx
  history/History.tsx             過去ログ遅延取得
  settings/{Settings,TimeSlots,Notifications}.tsx
features/
  today/{TodayView,TodayTaskItem,StatusButtons}.tsx
  task/{TaskForm,FrequencyPicker,TaskCard}.tsx
  timeslot/{TimeSlotList,TimeSlotEditor}.tsx
  stash/{StashPanel,PendingSyncBadge}.tsx
  notify/NotificationManager.tsx
hooks/{useTodayTasks,usePendingSyncCount,useNotificationPermission}.ts
sw/service-worker.ts        PWA + 将来の Web Push 拡張点
```

「今日のタスク」の導出（computed observable）:

1. 全 `tasks` のうち `archived_at IS NULL` をフィルタ
2. 各タスクで `isDueOn(task.frequency, today, task.created_at)` を評価し、真のものだけ残す
3. `task_logs` の `(task_id, today)` で status を突合（無ければ 'empty'）
4. `time_slot_id` でグループ化、各グループ内は `sort_order`

### 6.3 状態フロー

```
[ユーザー操作] → state$.task_logs[task_id][date].set({status: ...})
              ↓ (optimistic)
[UI 即時更新] ← computed observable 再評価
              ↓
[Supabase 同期] → 成功: 何もしない / 失敗: IndexedDB キュー
              ↓ (Realtime)
[他デバイス] ← task_logs 反映 + task_stash 反映（trigger 経由）
              ↓
[stash_view] ← 再計算（VIEW のため即時）
```

## 7. オフライン / PWA / 通知

### 7.1 オフラインキャッシュ

- legend-state IndexedDB プラグインで全 observable を端末永続化
- `syncedSupabase` の retry queue がオンライン復帰時に自動再送
- `navigator.onLine` + `online`/`offline` イベントで接続状態を監視
- `PendingSyncBadge` がキューに 1 件以上ある間「同期前」表示を `StashPanel` に出す

### 7.2 PWA

- `vite-plugin-pwa`（Workbox ベース）
- マニフェスト（アプリ名、アイコン、テーマカラー、`display: standalone`）
- Service Worker でアプリシェルをキャッシュ + 将来の Web Push 拡張点

### 7.3 通知の抽象化（browser / Tauri 切替対応）

```ts
interface NotificationProvider {
  requestPermission(): Promise<"granted" | "denied" | "prompt">;
  scheduleDaily(slots: SlotSchedule[]): void;
  cancelAll(): void;
}
```

| バージョン | 実装 | 動作条件 |
|---|---|---|
| v1（今回スコープ）| `WebNotificationProvider`（フォアグラウンドのみ: setTimeout + Notification API） | タブ／PWA 起動中 |
| v1.5（拡張余地）| Service Worker + Web Push + Supabase Edge Function + pg_cron | 閉じていても通知 |
| 将来（Tauri）| `TauriNotificationProvider`（`tauri-plugin-notification`）| ネイティブ |

- 通知許可は `/settings/notifications` でユーザー操作後に `requestPermission`
- 起動時に `time_slots` を購読し各スロットの `notify_at` で `setTimeout`
- 当日中に slot 時刻を過ぎた未操作タスクのみ通知（既に完了/スキップ/失敗のタスクは除外）

## 8. 認証 & ローカル Supabase 開発

### 8.1 セットアップ

- `supabase init` で `supabase/` ディレクトリを Git 管理
- `supabase start` でローカル環境（PostgreSQL/Auth/Realtime/Studio）を Docker 起動
- Studio: `http://localhost:54323`
- `apps/habits/.env.local` に `VITE_SUPABASE_URL=http://localhost:54321` / `VITE_SUPABASE_ANON_KEY=...`
- Email 確認は開発初期無効化
- 型生成: `supabase gen types typescript --local > packages/habit-sync/src/db-types.ts`

### 8.2 マイグレーション

命名規則: `YYYYMMDDHHMMSS_<name>.sql`（supabase CLI 出力と整合し、後続追加時のソート順を保証）

初期マイグレーション（2026-05-16 起点）:

```
20260516000001_extensions.sql              uuid-ossp等
20260516000002_profiles.sql                profiles + RLS
20260516000003_time_slots.sql              time_slots + RLS
20260516000004_tasks.sql                   tasks + frequency CHECK + RLS
20260516000005_task_logs.sql               task_logs + RLS + index
20260516000006_task_stash.sql              task_stash + RLS
20260516000007_frequency_function.sql      is_due_on()
20260516000008_task_stash_view.sql         task_stash_view
20260516000009_triggers.sql                task_logs → task_stash
20260516000010_realtime.sql                publication 登録
20260516000011_initial_user_data.sql       auth.users INSERT トリガー
```

## 9. テスト戦略

| 対象 | 種別 | ツール |
|---|---|---|
| `habit-core` 頻度評価 / streak | ユニット | vitest (node preset) — テーブル駆動 |
| `habit-sync` 楽観更新 / リトライ | 統合 | vitest + supabase local |
| `apps/habits` フック / コンポーネント | ユニット | vitest (react preset) + testing-library |
| SQL 関数 / トリガー | SQL | `supabase test db`（pgTAP）または seed-based assertions |
| サインアップ → 今日 → 完了 → stash | E2E | Playwright（`supabase start` 込み）|
| オフライン → 再接続 → 同期 | E2E | Playwright (`context.setOffline`) |

頻度評価のエッジケース:

- 月末（31 日 / 30 日）
- 第 5 週が存在する月／しない月
- 閏年の 2/29
- 年跨ぎ
- anchor 当日 vs 前後

CI: `CI=true pnpm nx affected -t typecheck lint test` + e2e。pre-commit-gate hook が既存。

## 10. Claude Design プロンプト出力

`docs/design-prompts/` 配下に画面ごとの Markdown プロンプト:

```
README.md            運用ガイド + 共通スタイル方針（モバイルファースト、トークン参照）
auth-login.md
auth-signup.md
today.md             メイン画面
tasks-list.md
task-edit.md         FrequencyPicker 含む
time-slots.md
history.md
stash-panel.md
settings.md
```

各プロンプトの共通構造:

- 画面の目的・前後コンテキスト
- 表示要素 / 必須情報
- インタラクション（タップ／ホバー／長押し）
- 状態（empty / loading / error / pending-sync / offline）
- レスポンシブ要件（〜640 / 〜1024 / 1025〜）
- アクセシビリティ要件（フォーカス、ARIA、コントラスト）
- 既存スタイル参照（Tailwind v4 トークン: `packages/config-tailwind/theme.css`）

Claude Design からの出力（React + Tailwind コンポーネント想定）は `apps/habits/src/features/*` に取り込む。

## 11. 実装マイルストーン

| # | 内容 |
|---|---|
| M1 | モノレポ整備（`apps/habits`, `packages/habit-core`, `packages/habit-sync` 雛形 + README 修正）|
| M2 | Supabase 基盤（`supabase init` + マイグレーション一式 + Realtime + RLS）|
| M3 | 認証フロー（Login/Signup + 初期データ自動生成トリガー）|
| M4 | ドメインロジック（`habit-core`: `isDueOn` / streak / status 型 + テスト）|
| M5 | 同期レイヤー（`habit-sync`: legend-state + syncedSupabase + IndexedDB）|
| M6 | Today 画面（時間帯グループ + StatusButtons + 楽観更新）|
| M7 | タスク管理（Task CRUD + FrequencyPicker + TimeSlot CRUD）|
| M8 | スタッシュ表示（StashPanel + PendingSyncBadge）|
| M9 | 履歴画面（過去ログ遅延取得）|
| M10 | 通知 v1（NotificationProvider + フォアグラウンドスケジューラ）|
| M11 | PWA 化（`vite-plugin-pwa` + SW + マニフェスト）|
| M12 | E2E / CI（Playwright + GH Actions）|
| M13 | Claude Design プロンプト出力 + UI ブラッシュアップ |

## 12. 検証方法

1. `supabase start` でローカル環境起動。Studio で migrations 適用と RLS を確認
2. `CI=true pnpm nx run-many -t typecheck lint test` が全パッケージで通過
3. `pnpm nx serve habits` で起動 → サインアップ → 朝/夜の初期タスクが表示
4. 完了/スキップ/失敗を切り替え → `task_stash` の各カウンタと `current_streak` が即時更新（Studio で確認）
5. DevTools でオフライン化 → 状態切り替え → `PendingSyncBadge` 表示 → オンライン復帰で同期
6. 通知許可 → slot 時刻に未操作タスクが通知される（タブ起動中）
7. Lighthouse で PWA installable をチェック
8. `pnpm nx e2e habits` で E2E シナリオ（サインアップ→完了→stash 反映、オフライン→同期）が緑

## 13. 将来拡張

- v1.5: Web Push（Supabase Edge Function + pg_cron + Web Push Protocol）
- v2: Tauri v2 で PC/モバイル ネイティブアプリ
- v2: SNS ログイン（Google / Apple / GitHub 等）

設計上、`NotificationProvider` インターフェース・`habit-core` 純粋ドメイン・`habit-sync` の Supabase クライアント差し替えで対応可能。

## 14. 参照

- 実装プラン: `docs/superpowers/plans/` （writing-plans スキルで M1〜M13 を展開）
- モノレポ運用: `CLAUDE.md`
- Supabase legend-state プラグイン: `@legendapp/state/sync-plugins/supabase`
- TanStack Router: ファイルベースルーティング + 型安全
