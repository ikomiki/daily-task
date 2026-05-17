# Habits アプリ 詳細仕様書

## 目次

1. [システム概要](#1-システム概要)
2. [モノレポ構成](#2-モノレポ構成)
3. [画面一覧とルーティング](#3-画面一覧とルーティング)
4. [機能仕様（画面ごと）](#4-機能仕様画面ごと)
5. [ドメインロジック（habit-core）](#5-ドメインロジックhabit-core)
6. [同期レイヤー（habit-sync）](#6-同期レイヤーhabit-sync)
7. [認証フロー](#7-認証フロー)
8. [通知仕様（v1）](#8-通知仕様v1)
9. [PWA 仕様](#9-pwa-仕様)
10. [エラーハンドリング・バリデーション](#10-エラーハンドリングバリデーション)
11. [技術スタック](#11-技術スタック)
12. [CI/CD](#12-cicd)
13. [今後の拡張予定](#13-今後の拡張予定)

---

## 1. システム概要

### 目的

毎日の習慣タスクを管理・記録し、継続性を可視化することで習慣形成を支援する。

### 対象ユーザー

習慣形成に取り組む個人ユーザー。技術的な知識は不要。

### 技術スタック（概要）

| 区分 | 技術 |
|------|------|
| フロントエンド | Vite + React 19 + TanStack Router + Tailwind CSS v4 |
| 状態管理 | Legend State v3 |
| バックエンド | Supabase（PostgreSQL + Auth + Realtime） |
| PWA | vite-plugin-pwa + Workbox |
| テスト | Vitest + Playwright |
| Lint/Format | Biome v2 |
| モノレポ | Nx |

---

## 2. モノレポ構成

### パッケージ一覧

```
daily-task/
├── apps/
│   └── habits/             # Web アプリ本体（Vite SPA）
├── packages/
│   ├── habit-core/         # 純粋ドメインロジック（頻度判定 / streak / status）
│   ├── habit-sync/         # 同期レイヤー（Legend State + Supabase）
│   ├── ui/                 # 共有UIコンポーネント（将来用）
│   ├── config-biome/       # Biome 設定共有
│   ├── config-tsconfig/    # TypeScript 設定共有
│   ├── config-tailwind/    # Tailwind 設定共有
│   └── config-vitest/      # Vitest 設定共有
├── supabase/
│   └── migrations/         # DB マイグレーションファイル
└── docs/                   # ドキュメント（本ドキュメントほか）
```

### 依存方向（一方向）

```
apps/habits
    │
    ▼
packages/habit-sync  ←── packages/ui（型のみ）
    │
    ▼
packages/habit-core
    │
    ▼
packages/config-*（設定のみ、ロジック依存なし）
```

- 循環依存は Nx グラフ（`pnpm nx graph`）で検出
- `habit-core` は他の packages に依存しない

### TypeScript ソース解決

各パッケージの `package.json` の `exports` に `@org/source` カスタム条件でソース（`.ts`）を直接公開。`customConditions: ["@org/source"]` により、TypeScript が dist ではなくソースを直接解決する。

---

## 3. 画面一覧とルーティング

### ルート定義

| URL | 画面名 | 認証 | 説明 |
|-----|-------|------|------|
| `/` | — | — | `/today` へリダイレクト |
| `/auth/login` | ログイン | 不要 | メール/パスワードログイン |
| `/auth/signup` | 新規登録 | 不要 | アカウント作成 |
| `/today` | 今日のタスク | **必須** | 本日のタスク一覧・ステータス操作 |
| `/tasks` | タスク管理 | **必須** | タスク一覧・追加・アーカイブ |
| `/tasks/new` | タスク作成 | **必須** | 新規タスク作成フォーム |
| `/tasks/$id` | タスク編集 | **必須** | タスク編集・アーカイブフォーム |
| `/stash` | スタッシュ | **必須** | タスク集計統計 |
| `/history` | 履歴 | **必須** | タスク別日付履歴 |
| `/settings/time-slots` | 時間帯設定 | **必須** | 時間帯の CRUD |
| `/settings/notifications` | 通知設定 | **必須** | ブラウザ通知許可管理 |

### AuthGate

認証が必要なルートへの未認証アクセスは `beforeLoad` で検知し、`/auth/login` にリダイレクトする。ログイン成功後は元のURLに戻る。

---

## 4. 機能仕様（画面ごと）

### 4.1 ログイン・新規登録

**UI 要素:**
- メールアドレス入力欄（type=email）
- パスワード入力欄（type=password）
- サブミットボタン
- ログイン↔新規登録の切り替えリンク
- サーバーエラーメッセージ表示エリア

**バリデーション:**
- メールアドレス: 必須、形式チェック（ブラウザ標準）
- パスワード: 必須、最小6文字

**動作:**
- 新規登録成功 → `/today` へ遷移、初期データが自動生成される
- ログイン成功 → `/today` へ遷移

---

### 4.2 今日のタスク画面 (`/today`)

**UI 要素:**
- ヘッダー（タイトル・ナビゲーション）
- 時間帯グループ（sort_order 昇順）
  - グループヘッダー: 時間帯名 + 通知時刻（HH:MM）
  - タスク一覧（sort_order 昇順）
    - タスク名
    - ステータスボタン（完了 / スキップ / 失敗）
- タスクがない場合: 「今日のタスクはありません」メッセージ

**ステータスボタン仕様:**

| 状態 | 表示 | UI |
|------|------|-----|
| 未記録（empty） | ボタン全て白抜き | — |
| 完了（complete） | 完了ボタンが緑で選択状態 | bg-green-600 |
| スキップ（skip） | スキップボタンが黄で選択状態 | bg-yellow-600 |
| 失敗（fail） | 失敗ボタンが赤で選択状態 | bg-red-600 |

**操作仕様:**
- ボタンクリック → 楽観的更新（即座にUI反映）→ Supabase へ送信
- 選択中のボタンを再クリック → ステータス削除（empty に戻す）
- 別のボタンをクリック → ステータス切り替え（INSERT か UPDATE）

**表示ロジック:**
- `getTodayTasksView(tasks, taskLogs, timeSlots, today)` で今日の表示データを計算
- `isDueOn(frequency, today, created_at)` で頻度判定（対象外の日は非表示）
- アーカイブ済みタスク（`archived_at IS NOT NULL`）は非表示

---

### 4.3 タスク管理画面 (`/tasks`)

**UI 要素:**
- ヘッダー（「新規追加」ボタン付き）
- アクティブタスク一覧（時間帯 sort_order → タスク sort_order 順）
  - タスク名 / 時間帯名 / 頻度サマリ
  - 編集ボタン（→ `/tasks/$id`）
  - アーカイブボタン
- アーカイブ済みタスクセクション（展開/折りたたみ）
  - 件数表示
  - 復元ボタン

**頻度サマリの表示形式:**

| 頻度タイプ | 表示例 |
|-----------|-------|
| daily | 毎日 |
| every_n_days | 3 日ごと（開始: 2026-05-17） |
| weekday | 月火水木金 |
| day_of_week (毎週) | 毎週土曜 |
| day_of_week (第N週) | 第 1 月曜 |
| every_n_weeks | 2 週ごと水曜（開始: 2026-05-17） |

---

### 4.4 タスク作成・編集フォーム (`/tasks/new`, `/tasks/$id`)

**フォーム要素:**
- タスク名: テキスト入力（必須）
- 時間帯: セレクトボックス（時間帯が0件の場合は無効化 + 警告表示）
- 頻度: FrequencyPicker コンポーネント

**FrequencyPicker の選択肢とサブフォーム:**

1. **毎日** — 追加入力なし
2. **N日ごと** — 間隔（数値、最小1）+ 開始日（date input）
3. **曜日指定** — 曜日チェックボックス（月〜日、複数選択可）、デフォルト月〜金
4. **曜日 + 第N週** — 曜日チェックボックス + 週チェックボックス（1〜5週、未選択=毎週）
5. **N週ごと** — 間隔（数値、最小1）+ 曜日ドロップダウン（単一）+ 開始日

**操作:**
- 作成: `createTask()` で UUID 発行・楽観更新
- 編集: `updateTask()` で部分更新
- アーカイブ: `archiveTask()` で `archived_at` を現在時刻に設定
- 復元: `unarchiveTask()` で `archived_at` を null に設定

---

### 4.5 スタッシュ画面 (`/stash`)

**UI 要素:**
- PendingSyncBadge（オフラインまたは pending > 0 のとき表示）
- タスクカード一覧（時間帯 sort_order → タスク sort_order 順）
  - タスク名 / 時間帯名
  - 統計グリッド（完了 / スキップ / 失敗 / 連続 / 対象日数 / 完了率 / 最終完了）

**PendingSyncBadge 表示条件:**
- `online$ === false` のとき「● オフライン」
- `getPendingSyncCount(state$) >= 1` のとき「同期前 N件」
- 両方を同時に表示可能

**数値の表示フォーマット:**
- count 系: 数値（null の場合は 0 として表示）
- completion_rate: `XX%`（null の場合は「—」）
- last_completed_date: `YYYY-MM-DD`（null の場合は「—」）

**データソース:** `useTaskStashList()` フック（`state$.tasks` と `state$.task_stash_view` を JOIN）

---

### 4.6 履歴画面 (`/history`)

**UI 要素:**
- タスク選択ドロップダウン（アーカイブ済み含む、名前昇順）
- 履歴リスト（日付降順）
  - 日付 | ステータスラベル
- 「もっと読み込む」ボタン（hasMore が true のとき）
- 読み込み中インジケーター
- 「これ以上履歴はありません」（hasMore が false のとき）

**データ取得ロジック:**
1. 直近31日: `state$.task_logs` から対象 taskId のログを抽出（メモリ内）
2. 32日以前: `loadTaskHistory(client, { taskId, beforeDate, limit: 31 })` で Supabase から遅延取得
3. タスク切り替え時: ローカル state をリセット（世代チェックで in-flight リクエストを破棄）

---

### 4.7 時間帯設定画面 (`/settings/time-slots`)

**UI 要素:**
- 時間帯一覧（sort_order 昇順）
  - 時間帯名 / 通知時刻
  - 編集ボタン / 削除ボタン
- インラインエディタ（新規追加 or 編集モード）
  - 時間帯名（必須）
  - 通知時刻（type=time, HH:MM）
  - 作成/保存ボタン + キャンセルボタン
- 「時間帯を追加」ボタン

**削除バリデーション:**
- 参照するタスクが1件以上存在する場合は削除不可（エラーメッセージ表示）
- 時間帯が1件のみの場合は削除不可

---

### 4.8 通知設定画面 (`/settings/notifications`)

**通知許可状態:**

| 状態値 | 表示 | アクション |
|-------|------|----------|
| `granted` | 許可済み | — |
| `denied` | 拒否済み | ブラウザ設定を案内 |
| `prompt` | 未許可 | 「通知を許可する」ボタン表示 |
| `unsupported` | ブラウザ非対応 | メッセージのみ表示 |

---

## 5. ドメインロジック（habit-core）

### 5.1 頻度判定 `isDueOn(rule, date, taskCreatedAt)`

**シグネチャ:**
```typescript
function isDueOn(rule: Frequency, date: string, taskCreatedAt: string): boolean
```

**共通ガード:** `date < taskCreatedAt` の場合は常に `false`

**頻度タイプ別判定:**

| タイプ | 判定ロジック |
|-------|------------|
| `daily` | 常に `true` |
| `every_n_days` | `(date - anchor) % n === 0`（anchor より前は false） |
| `weekday` | `isoDayOfWeek(date) ∈ days` |
| `day_of_week` | 曜日マッチ かつ 週数マッチ（weeks_of_month 未指定時は毎週） |
| `every_n_weeks` | 曜日マッチ かつ `(date - firstMatch) % (n * 7) === 0` |

**SQL版との対応:** `supabase/migrations/` の `is_due_on()` 関数と同等のロジックを実装。サーバー側集計（task_days 計算）に使用される。

### 5.2 Streak 計算 `calculateStreak(logsAsc)`

**ルール:**
- ログを末尾（最新）から走査
- `complete` → streak +1
- `skip` → streak 維持（増えない）
- `fail` → 走査を打ち切り（streak はリセット）

**注意:** 呼び出し側が頻度対象日のログのみを渡す責務を持つ。この関数自体は頻度判定を行わない。

### 5.3 日付ユーティリティ

```typescript
toUtcDays(yyyyMmDd: string): number
// 'YYYY-MM-DD' を UTC エポック日数（整数）に変換

isoDayOfWeek(yyyyMmDd: string): number
// 1=月, 2=火, ..., 7=日（ISO 8601準拠）

weekOfMonth(yyyyMmDd: string): number
// 月内の第N週（1〜5）
```

### 5.4 型定義

```typescript
type Frequency =
  | { type: 'daily' }
  | { type: 'every_n_days'; n: number; anchor: string }
  | { type: 'weekday'; days: number[] }
  | { type: 'day_of_week'; days: number[]; weeks_of_month?: number[] }
  | { type: 'every_n_weeks'; n: number; day_of_week: number; anchor: string }

type TaskStatus = 'complete' | 'skip' | 'fail'
type DisplayTaskStatus = TaskStatus | 'empty'
```

---

## 6. 同期レイヤー（habit-sync）

### 6.1 Observable State

```typescript
const state$ = observable<SyncStateShape>({
  user: null,                    // Supabase User
  time_slots: {},                // Record<id, TimeSlot>
  tasks: {},                     // Record<id, Task>
  task_logs: {},                 // Record<`${task_id}-${date}`, TaskLog>
  task_stash_view: {},           // Record<task_id, TaskStashView>
})
```

### 6.2 同期設定（4コレクション）

| コレクション | 方向 | Realtime | Filter | fieldId |
|-----------|------|---------|--------|---------|
| `time_slots` | 双方向 | ON | — | — |
| `tasks` | 双方向 | ON | — | — |
| `task_logs` | 双方向 | ON | `date >= today - 31日` | `task_id` |
| `task_stash_view` | 読取専用 | OFF ※ | — | `task_id` |

※ VIEW は Supabase Realtime publication 対象外のため `realtime: false`。代わりに `task_stash` テーブルの postgres_changes を直接購読し、変更時に当該行を再フェッチする。

### 6.3 task_stash_view のリアルタイム更新フロー

```
ユーザー操作（setTaskLogStatus）
    ↓
state$.task_logs 楽観更新 → Supabase INSERT/UPDATE
    ↓（サーバー側）
task_logs_update_stash トリガー → task_stash 行を再集計
    ↓（Realtime）
task_stash テーブルの postgres_changes イベント発火
    ↓（クライアント）
channel('task_stash_view_refresh') が payload を受信
    ↓
supabase.from('task_stash_view').select('*').eq('task_id', id) で再フェッチ
    ↓
state$.task_stash_view[taskId].set(data)
```

### 6.4 楽観更新

全ての書き込み操作は state$ に直接書き込むことで楽観的更新を行う。Legend State が変更を検知し、syncedSupabase プラグインが Supabase に送信する。

**書き込みヘルパー一覧:**

| 関数 | 対象 | 操作 |
|------|------|------|
| `createTask(input)` | tasks | INSERT |
| `updateTask(id, patch)` | tasks | UPDATE |
| `archiveTask(id)` | tasks | UPDATE (archived_at 設定) |
| `unarchiveTask(id)` | tasks | UPDATE (archived_at: null) |
| `createTimeSlot(input)` | time_slots | INSERT |
| `updateTimeSlot(id, patch)` | time_slots | UPDATE |
| `deleteTimeSlot(id)` | time_slots | DELETE |
| `setTaskLogStatus(taskId, date, status)` | task_logs | UPSERT |
| `clearTaskLogStatus(taskId, date)` | task_logs | DELETE |

### 6.5 IndexedDB 永続化

`configureSyncPersistence({ databaseName: 'habits-cache', tableNames })` でアプリ起動時に1度だけ設定する。

**効果:**
- オフライン時の書き込みをキューイング（再接続後に自動送信）
- キャッシュにより二回目以降の起動が高速化

**副作用と対策:**
- IndexedDB プラグインが `value.id = key` でオブジェクトをミューテートする副作用がある
- `task_logs` は複合 PK (task_id, date) のため `id` カラムが存在せず、注入された `id` をそのまま Supabase に送ると PGRST204 エラーになる
- `transform.save` で `stripPersistInjectedId()` を呼び、送信前に `id` を除去して対処

### 6.6 Pending Sync Count

```typescript
getPendingSyncCount(state$): number
```

`tasks` / `time_slots` / `task_logs` の `syncState().numPendingSets` を合算して返す。スタッシュ画面の PendingSyncBadge に使用。

### 6.7 オンライン状態管理

```typescript
const online$ = observable<boolean>(true)
function startOnlineWatcher(): () => void
```

`navigator.onLine` イベント（online / offline）を監視して `online$` を更新。SSR 環境では常に `true`。

### 6.8 過去ログ遅延取得

```typescript
loadTaskHistory(client, { taskId, beforeDate, limit }): Promise<TaskLog[]>
```

`task_logs` テーブルから `date < beforeDate` の行を `date DESC` で `limit` 件取得。`useTaskHistory` フックがページネーションを管理する。

---

## 7. 認証フロー

### 7.1 新規登録

```
/auth/signup フォーム送信
    ↓
supabase.auth.signUp({ email, password })
    ↓（成功）
auth.users に INSERT → handle_new_user() トリガー発火
→ profiles + 2 time_slots + 6 tasks が自動生成
    ↓
onAuthStateChange イベント（SIGNED_IN）
→ state$.user.set(user)
→ /today へ遷移
```

### 7.2 ログイン

```
/auth/login フォーム送信
    ↓
supabase.auth.signInWithPassword({ email, password })
    ↓（成功）
onAuthStateChange イベント（SIGNED_IN）
→ state$.user.set(user)
→ /today へ遷移
```

### 7.3 セッション維持

`useAuthSession` フックがアプリ起動時に localStorage からセッションを復元し、`onAuthStateChange` を購読する。

- `SIGNED_IN` → `state$.user.set(user)`
- `SIGNED_OUT` → `state$.user.set(null)`
- `TOKEN_REFRESHED` → セッション自動更新

### 7.4 AuthGate

```typescript
// router.tsx の各認証ルートの beforeLoad
async function requireAuth({ location }) {
  if (!state$.user.get()) {
    throw redirect({ to: '/auth/login', search: { redirect: location.href } })
  }
}
```

---

## 8. 通知仕様（v1）

### 8.1 通知権限

```typescript
type DisplayPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'
```

`Notification.permission` の `'default'` は `'prompt'` に正規化する。Notification API 未対応ブラウザは `'unsupported'` とする。

### 8.2 スケジュール方式

`WebNotificationProvider.scheduleDaily(slots, onFire)` が各時間帯の通知時刻（ローカル時刻）に `setTimeout` を予約する。

**発火条件:** `getSlotPendingNotificationTasks()` で当日の未完了タスク（status = 'empty'）が1件以上存在する場合のみ通知を表示する。

**発火内容:** `provider.show(slot.name, "{N}件のタスクが未完了です")`

**制約（v1）:**
- アプリをフォアグラウンドで開いている間のみ動作
- 日跨ぎの自動再スケジュールは未対応
- バックグラウンド/Service Worker Push は未実装

### 8.3 DI（テスト用）

`WebNotificationProvider` は `{ now: () => Date }` でクロックを DI 可能。`vi.useFakeTimers()` でのテストに対応。

---

## 9. PWA 仕様

### 9.1 vite-plugin-pwa 設定

```typescript
VitePWA({
  registerType: 'autoUpdate',    // 新バージョン検知で自動更新
  devOptions: { enabled: false }, // 開発環境では SW 無効
  manifest: { ... },
  workbox: {
    navigateFallbackDenylist: [/^\/api/, /^\/auth\//],
    globPatterns: ['**/*.{js,css,html,svg,ico,woff2}']
  }
})
```

### 9.2 マニフェスト

| プロパティ | 値 |
|---------|-----|
| name | Habits |
| short_name | Habits |
| display | standalone |
| theme_color | #0f172a |
| background_color | #0f172a |
| lang | ja |
| start_url | / |

### 9.3 アイコン

| ファイル | 用途 |
|---------|------|
| `public/icon-192.svg` | アイコン 192×192 |
| `public/icon-512.svg` | アイコン 512×512 |
| `public/icon-maskable.svg` | マスカブルアイコン 512×512 |
| `public/favicon.svg` | ブラウザ favicon |

iOS の `apple-touch-icon` は `icon-192.svg` を参照（`<link rel="apple-touch-icon">`）。

### 9.4 キャッシュ戦略

Workbox によるプリキャッシュ: `*.{js,css,html,svg,ico,woff2}`

ネットワーク通信（Supabase API / Realtime）はキャッシュしない。

`/api` と `/auth/*` は SPA のナビゲーションフォールバックから除外（バックエンドルートへ転送）。

---

## 10. エラーハンドリング・バリデーション

### 10.1 フォームバリデーション

| フィールド | ルール |
|---------|-------|
| タスク名 | 必須・空文字不可 |
| パスワード | 最小6文字 |
| 時間帯名 | 必須・空文字不可 |
| N日ごとの間隔 | 最小1 |
| N週ごとの間隔 | 最小1 |

### 10.2 時間帯削除ガード

`deleteTimeSlot()` はアプリレベルで事前検証する。参照するタスクが存在する場合は削除せずにエラーメッセージを返す。

### 10.3 PGRST204 対策

IndexedDB プラグインが `id` フィールドを注入する副作用に対し、`transform.save` で `stripPersistInjectedId()` を呼び出すことで対処。

### 10.4 React StrictMode 対応

`useEffect` の二重実行による `setupSync` の重複呼び出しを `WeakSet<object>` ガード（`taskStashSubscribedClients`）で防止。

### 10.5 環境変数未設定エラー

`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` が未設定の場合、アプリ起動時に明確なエラーメッセージを表示してロードをブロックする。

---

## 11. 技術スタック

### 主要ライブラリとバージョン

| カテゴリ | ライブラリ | バージョン |
|---------|-----------|-----------|
| React | react | ^19.0.0 |
| React | react-dom | ^19.0.0 |
| ビルド | vite | ^7.0.0 |
| ビルド | @vitejs/plugin-react | ^5.0.0 |
| スタイリング | tailwindcss | ^4.0.0 |
| スタイリング | @tailwindcss/vite | ^4.0.0 |
| ルーティング | @tanstack/react-router | ^1.0.0 |
| 状態管理 | @legendapp/state | 3.0.0-beta.47（固定） |
| バリデーション | zod | ^4.0.0 |
| バックエンド | @supabase/supabase-js | ^2.0.0 |
| PWA | vite-plugin-pwa | ^1.0.0 |
| PWA | workbox-window | ^7.0.0 |
| テスト | vitest | ^3.0.0 |
| テスト | @testing-library/react | ^16.0.0 |
| テスト | jsdom | ^26.0.0 |
| テスト | fake-indexeddb | 6.0.0（固定） |
| E2E | @playwright/test | ^1.50.0 |
| Lint/Format | @biomejs/biome | ^2.0.0 |
| TypeScript | typescript | ~5.9.2 |
| モノレポ | nx | （catalog 管理） |

**Legend State v3 beta.47 固定の理由:** 設計上 v3 の API が必要なため beta pin。安定版リリース後に更新予定。

---

## 12. CI/CD

### GitHub Actions（`.github/workflows/ci.yml`）

**トリガー:** `main` への push / PR

**ステップ:**

1. **Biome** — `pnpm exec biome ci .`（format + lint）
2. **型チェック + テスト** — `pnpm nx affected -t typecheck test --parallel=3`
3. **ビルド** — `pnpm nx affected -t build --parallel=3`
4. **Playwright インストール** — `pnpm exec playwright install --with-deps chromium`
5. **E2E** — `pnpm nx affected -t e2e`

**Node バージョン:** `.nvmrc` で v24 系を指定（v26 系では Playwright インストールが停止するため）

---

## 13. 今後の拡張予定

| バージョン | 機能 | 概要 |
|-----------|------|------|
| v1.5 | Web Push 通知 | バックグラウンド通知。Supabase Edge Function + pg_cron + Web Push Protocol |
| v2 | Tauri v2 ネイティブアプリ | PC / モバイルのネイティブアプリ対応 |
| v2 | SNS ログイン | Google / Apple / GitHub アカウントでのサインイン |

**拡張性の設計:**
- `NotificationProvider` インターフェース抽象化: ブラウザ版 ↔ Tauri ネイティブ版を差し替え可能
- `habit-core` 純粋ドメイン設計: UI フレームワーク非依存
- `habit-sync` クライアント DI: Supabase 以外の BaaS への移行も対応可能
