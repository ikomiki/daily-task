# テスト仕様書

## 目次

1. [テスト戦略概要](#1-テスト戦略概要)
2. [テスト環境・ツール](#2-テスト環境ツール)
3. [ユニットテスト仕様](#3-ユニットテスト仕様)
4. [インテグレーションテスト仕様](#4-インテグレーションテスト仕様)
5. [E2E テスト仕様](#5-e2e-テスト仕様)
6. [テスト実行コマンド](#6-テスト実行コマンド)
7. [テスト設定](#7-テスト設定)
8. [CI でのテスト](#8-ci-でのテスト)

---

## 1. テスト戦略概要

### テストピラミッド

```
        /─────────────────────\
       /     E2E テスト（M12）   \   少数・シナリオ検証
      /───────────────────────────\
     /   インテグレーションテスト    \   中数・境界検証
    /─────────────────────────────────\
   /         ユニットテスト             \  多数・ロジック検証
  /─────────────────────────────────────\
```

### カバレッジ方針

- **ドメインロジック（habit-core）:** ほぼ 100%。頻度計算・streak 計算は実装の核心。
- **同期レイヤー（habit-sync）:** 主要パス 100%。副作用（IndexedDB ミューテーション等）も検証。
- **UI コンポーネント（apps/habits）:** フック層を重点的に。レンダリングは最低限。
- **E2E:** ゴールデンパス（サインアップ → タスク完了 → 統計反映）を網羅。

### テストで検証しないこと

- Supabase 内部の動作（信頼する）
- Legend State ライブラリ自体の動作（ベンダーのテストを信頼する）
- ブラウザ固有の UI 描画（Playwright E2E でカバー）

---

## 2. テスト環境・ツール

| ツール | 用途 | 設定 |
|-------|------|------|
| Vitest v3 | ユニット・インテグレーションテスト | `packages/config-vitest/` の preset |
| jsdom | DOM 環境エミュレーション | React コンポーネント・フックのテスト |
| fake-indexeddb v6 | IndexedDB エミュレーション | persist plugin テスト |
| @testing-library/react | React コンポーネント・フックテスト | `renderHook` / `act` |
| Playwright v1.50 | E2E テスト（M12 で本格利用） | `apps/habits/playwright.config.ts` |

### Vitest Preset 一覧

`packages/config-vitest/` に3種類の preset が定義されている。

| Preset | 環境 | 用途 |
|--------|------|------|
| `node` | Node.js | habit-core・habit-sync 等の純粋ロジック |
| `react` | jsdom | React コンポーネント・フック |
| `pixi` | — | （将来用） |

---

## 3. ユニットテスト仕様

### 3.1 `packages/habit-core`

#### `frequency.test.ts` — 頻度判定 `isDueOn()`

| テストケース | 概要 |
|-----------|------|
| `daily` | 任意の日付で true を返す |
| `every_n_days` | anchor ちょうどの日・n日後・n-1日後の判定 |
| `every_n_days` | anchor より前の日付は false |
| `weekday` | 指定曜日で true、それ以外で false |
| `weekday` | 複数曜日指定 |
| `day_of_week` | 曜日 + 第N週が一致する日で true |
| `day_of_week` | weeks_of_month 未指定で毎週 true |
| `day_of_week` | 第5週のケース |
| `every_n_weeks` | anchor の曜日からの計算 |
| `every_n_weeks` | n 週後の曜日で true、それ以外で false |
| 共通 | taskCreatedAt より前の日付は常に false |
| エッジケース | 月末・閏年（2月29日）・年跨ぎ |

#### `streak.test.ts` — 連続達成計算 `calculateStreak()`

| テストケース | 概要 |
|-----------|------|
| 連続 complete | streak が正しく加算される |
| skip を挟む | streak が維持される（skip はカウントしない） |
| fail で終わる | streak が 0 になる |
| fail の前に complete | fail で止まり、それ以前の complete は無視 |
| ログが空 | streak = 0 |
| skip のみ | streak = 0（complete がない） |

#### `dates.test.ts` — 日付ユーティリティ

| テストケース | 概要 |
|-----------|------|
| `toUtcDays` | 既知の日付のエポック日数変換 |
| `isoDayOfWeek` | 月=1, ..., 日=7 の確認 |
| `weekOfMonth` | 第1〜第5週の判定（月末エッジ） |

---

### 3.2 `packages/habit-sync`

#### `sync.test.ts` — 同期設定

| テストケース | 概要 |
|-----------|------|
| `getTaskLogsCutoffDate` | today から 31 日前を正確に計算する |
| `getTaskLogsCutoffDate` | 月跨ぎ・年跨ぎのケース |
| `setupSync` | SupabaseClient を受け取って例外なく実行できる |
| `setupSync` | state$ の 4 コレクションが Record として残る |
| `setupSync` | realtime: true のとき task_stash チャンネルを確立する |
| `setupSync` | 同一 client で 2 回実行してもチャンネルが重複しない（StrictMode 対策） |
| `stripPersistInjectedId` | id プロパティがなければそのまま返す |
| `stripPersistInjectedId` | id プロパティだけを除去した新しいオブジェクトを返す |
| `stripPersistInjectedId` | 元オブジェクトを破壊しない |

#### `computed.test.ts` — 今日のタスクビュー `getTodayTasksView()`

| テストケース | 概要 |
|-----------|------|
| アクティブタスクのみ | archived_at が null でないタスクは除外 |
| 頻度フィルタ | isDueOn() が false のタスクは除外 |
| ステータス結合 | task_logs のステータスを正しく結合する |
| 未操作 | task_logs がない場合 status = 'empty' |
| グループ化 | time_slot_id ごとにグループ化される |
| ソート | slot.sort_order → task.sort_order で昇順 |

#### `task-write.test.ts` — タスク書き込み

| テストケース | 概要 |
|-----------|------|
| `createTask` | state$.tasks に新しいエントリが追加される |
| `createTask` | 返り値が文字列の UUID |
| `updateTask` | 指定フィールドが更新される |
| `archiveTask` | archived_at が設定される |
| `unarchiveTask` | archived_at が null になる |

#### `task-log-write.test.ts` — タスクログ書き込み

| テストケース | 概要 |
|-----------|------|
| `setTaskLogStatus` | 指定 key に status が設定される |
| `clearTaskLogStatus` | 指定 key の状態が削除される |
| `taskLogKey` | `${taskId}-${date}` の形式を返す |

#### `time-slot-write.test.ts` — 時間帯書き込み

| テストケース | 概要 |
|-----------|------|
| `createTimeSlot` | state$.time_slots に追加される |
| `updateTimeSlot` | フィールドが更新される |
| `deleteTimeSlot` | 対象エントリが削除される |

#### `pending-sync.test.ts` — 未同期件数

| テストケース | 概要 |
|-----------|------|
| pending 0 | 全コレクションが 0 のとき 0 を返す |
| pending あり | tasks/time_slots/task_logs の合計を返す |

#### `online.test.ts` — オンライン状態管理

| テストケース | 概要 |
|-----------|------|
| 初期値 | `navigator.onLine` の初期値を設定する |
| オフラインイベント | offline イベントで online$ が false になる |
| オンラインイベント | online イベントで online$ が true になる |
| クリーンアップ | 返り値の関数でイベントリスナーが解除される |

#### `history.test.ts` — 過去ログ取得

| テストケース | 概要 |
|-----------|------|
| `loadTaskHistory` | Supabase client から正しいクエリで取得する |
| `loadTaskHistory` | beforeDate フィルタが適用される |
| `loadTaskHistory` | limit 件数が守られる |

---

### 3.3 `apps/habits`

#### `hooks/useTodayTasks.test.tsx`

| テストケース | 概要 |
|-----------|------|
| 空 state | 空配列を返す |
| 頻度フィルタ | 今日が対象外のタスクは除外される |
| ステータス反映 | task_logs のステータスが反映される |

#### `hooks/useTaskStashList.test.tsx`

| テストケース | 概要 |
|-----------|------|
| アクティブタスクのみ | アーカイブ済みは除外 |
| stash なし | 全カラム null の行として返す |
| ソート | slot.sort_order → task.sort_order |

#### `hooks/useNotificationPermission.test.ts`

| テストケース | 概要 |
|-----------|------|
| API なし | 'unsupported' を返す |
| 'default' | 'prompt' に正規化される |
| 'granted' | そのまま 'granted' |
| requestPermission | 'granted' → state が更新される |

---

## 4. インテグレーションテスト仕様

### 4.1 IndexedDB persist テスト（`persist.test.ts`）

**環境:** jsdom + fake-indexeddb

| テストケース | 概要 |
|-----------|------|
| `configureSyncPersistence` | global プラグインが登録される |
| 重複呼び出し | 2 回呼んでも例外が発生しない |

### 4.2 setupSync インテグレーション（`sync.test.ts`）

**環境:** jsdom + fake-indexeddb + SupabaseClient スタブ

`configureSyncPersistence()` を実行した状態で `setupSync()` を呼び、例外が発生しないことを検証する。実際の IndexedDB 書き込みが発生する統合テスト。

---

## 5. E2E テスト仕様

**ステータス:** M12（近日実装予定）

### 主要シナリオ

#### シナリオ 1: 新規ユーザーのサインアップ

```
1. /auth/signup にアクセス
2. メール・パスワードを入力して「新規登録」をクリック
3. /today にリダイレクトされることを確認
4. 初期タスク（最低1件）が表示されることを確認
```

#### シナリオ 2: タスクのステータス操作

```
1. ログイン済み状態で /today を開く
2. タスクの「完了」ボタンをクリック
3. ボタンが緑色に変わることを確認
4. 同じボタンを再クリック → ボタンが白抜きに戻ることを確認
5. 「スキップ」ボタンをクリック → 黄色になることを確認
```

#### シナリオ 3: スタッシュへの反映

```
1. タスクを「完了」として記録する
2. /stash を開く
3. 対象タスクの「完了」カウントが増えていることを確認
4. 「連続」が 1 以上になっていることを確認
```

#### シナリオ 4: タスクの作成と表示

```
1. /tasks/new でタスクを作成（タスク名・時間帯・頻度）
2. /tasks 一覧に表示されることを確認
3. /today にそのタスクが表示されることを確認（頻度が今日に合致する場合）
```

#### シナリオ 5: オフライン動作

```
1. DevTools でネットワークをオフラインに設定
2. タスクのステータスを記録する
3. /stash で「オフライン」バッジが表示されることを確認
4. ネットワークを復元する
5. 「オフライン」バッジが消えることを確認
```

### E2E 実行環境

- ブラウザ: Chromium（headless）
- Node.js: v24 系（`.nvmrc` 参照）
- ローカル Supabase 必須

---

## 6. テスト実行コマンド

### 基本

```bash
# 全パッケージのテスト（並列3）
CI=true pnpm nx run-many -t test

# 影響を受けるパッケージのみ
CI=true pnpm nx affected -t test

# 単一プロジェクトのテスト
pnpm nx test habit-core
pnpm nx test habit-sync
pnpm nx test habits
```

### 絞り込み

```bash
# テスト名で絞り込み（vitest の -t フラグ）
pnpm nx test habit-core -- -t "isDueOn"
pnpm nx test habit-sync -- -t "setupSync"

# ファイルパターンで絞り込み
pnpm nx test habit-core -- src/frequency.test.ts
```

### Vitest UI（対話型ブラウザUI）

```bash
pnpm nx test habit-core -- --ui
```

### ウォッチモード

```bash
# ファイル変更を監視してリテスト
pnpm nx test habit-core -- --watch
```

---

## 7. テスト設定

### `packages/config-vitest/` の構成

```
config-vitest/
├── node.ts      # Node.js 環境 preset（habit-core, habit-sync 用）
├── react.ts     # jsdom 環境 preset（apps/habits 用）
└── setup.ts     # グローバル setup（fake-indexeddb auto import）
```

### 各パッケージの vitest.config.ts

```typescript
// packages/habit-core/vitest.config.ts
import { defineConfig } from 'vitest/config';
import { nodePreset } from '@org/config-vitest/node';
export default defineConfig(nodePreset);

// apps/habits/vitest.config.ts
import { defineConfig } from 'vitest/config';
import { reactPreset } from '@org/config-vitest/react';
export default defineConfig(reactPreset);
```

### fake-indexeddb の setup

`packages/config-vitest/setup.ts` に `import 'fake-indexeddb/auto'` が含まれており、全テストで自動的に使用される。

habit-sync のテストで `configureSyncPersistence()` を呼ぶ際は、`beforeEach` で呼び出すことを推奨。

### モック方針

- **SupabaseClient:** `vi.fn()` でスタブを作成（実際の Supabase に接続しない）
- **Notification API:** `vi.stubGlobal('Notification', ...)` でブラウザ API をスタブ
- **fake timers:** `vi.useFakeTimers()` で `WebNotificationProvider` の setTimeout をテスト
- **IndexedDB:** `fake-indexeddb` ライブラリで完全エミュレーション

---

## 8. CI でのテスト

### GitHub Actions のテストステップ

```yaml
- name: typecheck + test
  run: pnpm nx affected -t typecheck test --parallel=3
  env:
    CI: true
```

**`nx affected`:** ベースブランチ（main）との差分から影響を受けるプロジェクトのみテストする。PR での実行時間を短縮できる。

**`--parallel=3`:** 最大3プロジェクトを並列実行。

### テスト失敗時の調査

1. CI ログで失敗したテストファイルとテスト名を確認する
2. ローカルで `pnpm nx test <project> -- -t "<テスト名>"` で再現する
3. 必要に応じて `--reporter=verbose` を追加する

```bash
# 詳細ログで実行
pnpm nx test habit-sync -- --reporter=verbose
```
