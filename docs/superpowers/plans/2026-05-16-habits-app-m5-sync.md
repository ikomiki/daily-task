# Habits App — M5: 同期レイヤー 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設計仕様 `docs/superpowers/specs/2026-05-16-habits-app-design.md` §6.1 / §6.3 / §7.1 を満たし、`packages/habit-sync` の `state$` を legend-state の `syncedSupabase` プラグインに接続して `time_slots` / `tasks` / `task_logs` / `task_stash_view` の 4 テーブル / VIEW を双方向同期する。IndexedDB 永続化で書き込みキューを保持し、`task_logs` は直近 31 日のみ初期ロードする。「今日のタスク」を導出する純粋関数と React hook、`navigator.onLine` の observable、pending 件数の observable を提供して M6 以降が消費できる土台を作る。

**Architecture:** `packages/habit-sync` が同期層 SDK として全責務を負う:
- `observables.ts` で `state$` の型と 4 テーブルのプレースホルダを定義
- `persist.ts` で `configureObservableSync` + `ObservablePersistIndexedDB` の global 設定
- `sync.ts` で `setupSync(state$, client)` を提供し 4 テーブルを `syncedSupabase` に接続
- `computed.ts` で「今日のタスク」を導出する純粋関数 `getTodayTasksView`
- `online.ts` で `navigator.onLine` を購読する observable
- `pending-sync.ts` で `syncState(state$)` 経由の pending writes 件数取得
- `apps/habits` 側は `hooks/useTodayTasks` + `hooks/useSyncBootstrap` で消費

純粋ロジック（computed）は jsdom 不要の node preset で TDD、IndexedDB は `fake-indexeddb` で再現、`syncedSupabase` 自体は提供ライブラリの黒箱として信頼し、設定オブジェクトの構造とラッパーコードの正しさをテストする。

**Tech Stack:** `@legendapp/state` 3.0.0-beta.47 / `@legendapp/state/sync-plugins/supabase` の `syncedSupabase` / `@legendapp/state/persist-plugins/indexeddb` の `ObservablePersistIndexedDB` / `fake-indexeddb` (test only) / `@org/habit-core` の `isDueOn` / vitest 3 (node preset for habit-sync, react preset for habits)

**前提条件:**
- M4 完了済（`main` の最新が `69fd2e7 Merge branch 'feature/habits-m4-domain' into main`）
- 既存 `packages/habit-sync/src/observables.ts` は `state$` のプレースホルダ実装
- 既存 `packages/habit-sync/src/supabase.ts` は `getSupabaseClient(config)` シングルトン
- 既存 `packages/habit-sync/src/db-types.ts` は M2 で生成済 (Database / Json / public.task_status 等)
- `@legendapp/state` カタログ依存は `3.0.0-beta.47` で固定済（[[tech-legend-state-v3-beta]]）
- 新規ブランチ `feature/habits-m5-sync` を `main` から切って作業
- 設計仕様: §5.1（テーブルスキーマ）/ §6.1 / §6.3 / §7.1

---

## ファイル構造（作成・変更対象）

```
pnpm-workspace.yaml                     変更 — fake-indexeddb を catalog に追加

packages/habit-sync/
  package.json                          変更 — devDeps に fake-indexeddb 追加
  vitest.config.ts                      変更 — fake-indexeddb の setup ファイル指定
  src/
    test-setup.ts                       新規 — fake-indexeddb/auto を import するだけ
    types.ts                            新規 — Task / TimeSlot / TaskLog / TaskStashView の Row 型を db-types から抽出して re-export
    types.test.ts                       新規 — 型の整合スモーク
    computed.ts                         新規 — getTodayTasksView 純粋関数
    computed.test.ts                    新規 — テーブル駆動テスト
    persist.ts                          新規 — IndexedDB 永続化 configure ヘルパー
    persist.test.ts                     新規 — fake-indexeddb で永続化挙動を検証
    online.ts                           新規 — online$ observable + navigator.onLine 監視
    online.test.ts                      新規
    sync.ts                             新規 — setupSync(state$, client) で 4 テーブル接続
    sync.test.ts                        新規 — syncedSupabase config の shape 検証
    pending-sync.ts                     新規 — getPendingSyncCount(state$) + usePendingSyncCount フック
    pending-sync.test.ts                新規
    observables.ts                      変更 — state$ の型を Record<id, Row> 形式に拡張
    index.ts                            変更 — 新規エクスポート

apps/habits/
  src/
    hooks/
      useTodayTasks.ts                  新規 — state$ + isDueOn 経由で今日のタスクビュー
      useTodayTasks.test.tsx            新規
      useSyncBootstrap.ts               新規 — 起動時に configurePersistence + setupSync
      useSyncBootstrap.test.tsx         新規
    App.tsx                             変更 — useSyncBootstrap() を useAuthSession() の隣で呼ぶ
    App.test.tsx                        変更 — useSyncBootstrap の mock 追加
```

**依存方向（変更なし）:** `apps/habits → packages/{habit-sync, habit-core}`、`packages/habit-sync → packages/habit-core`（型のみ）。`computed.ts` は `habit-core` の `isDueOn` / `LogEntry` 型を参照する。

---

## 共通方針

### syncedSupabase の扱い

`syncedSupabase` は legend-state の同期プラグインで、`SupabaseClient` を引数に取り `collection`（テーブル名）と各種オプションを設定する。実装の中身（リトライ、楽観更新、Realtime 通知）は提供ライブラリに任せる。テストでは:
- `setupSync` が返す observable の shape を確認
- 設定オブジェクト（filter 関数、realtime フラグ、persist 名）が仕様通りに渡されているかを検証
- `SupabaseClient` は最小限のスタブを `as unknown as SupabaseClient` で渡す

### IndexedDB 永続化

`ObservablePersistIndexedDB` は global の `configureObservableSync({ persist: { plugin: ... } })` で 1 度だけ設定する。テストでは `fake-indexeddb/auto` を vitest setup file で import し、`indexedDB` グローバルが自動で fake 実装に切り替わるようにする。

### 純粋ロジック優先

「今日のタスク」導出（§6.3 の 4-step）は純粋関数 `getTodayTasksView(tasks, taskLogs, timeSlots, today)` に集約し、observable に依存しないため node preset で大量のテストが可能。React hook はこの純粋関数を `use$` でラップするだけにする。

### `task_logs` の filter

仕様 §6.1: `filter: (q) => q.gte("date", today.minusDays(31))`。これは syncedSupabase の `filter` プロパティに渡す PostgrestFilterBuilder 関数。`today` は実行時の `new Date()` から計算するため、ヘルパー関数 `getTaskLogsCutoffDate(today)` を作って TDD でテスト可能にする。

### コミット

各 Task の最後で単独コミット。pre-commit-gate hook が `pnpm nx affected -t lint test` を自動実行する。

---

## Task 1: `fake-indexeddb` を test 依存に追加 + vitest setup

**目的:** `IndexedDB` を vitest（node 環境）で動かすために `fake-indexeddb/auto` を setup file で import する。pnpm catalog 経由でバージョン固定。

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `packages/habit-sync/package.json`
- Create: `packages/habit-sync/src/test-setup.ts`
- Modify: `packages/habit-sync/vitest.config.ts`

- [ ] **Step 1: `pnpm-workspace.yaml` の catalog セクションに追加**

Read `pnpm-workspace.yaml` first to find the `catalog:` section.

`pnpm-workspace.yaml` の `catalog:` セクションに次の行を追加（既存の項目の末尾、アルファベット順を保つなら "@" 系の後の通常パッケージ位置）:

```yaml
  fake-indexeddb: 6.0.0
```

> **バージョン選定理由:** 6.0.0 は本プラン作成時点の安定版。pnpm の minimumReleaseAge（3 日）にかかる場合は古いバージョン (5.x) でも可。`6.0.0` で `pnpm install` が cooldown 警告を出した場合は `5.0.2` に下げる。

- [ ] **Step 2: `packages/habit-sync/package.json` の devDependencies に追加**

Read current contents, then add `"fake-indexeddb": "catalog:"` to `devDependencies` (アルファベット順を保つ):

```json
  "devDependencies": {
    "@org/config-biome": "workspace:*",
    "@org/config-tsconfig": "workspace:*",
    "@org/config-vitest": "workspace:*",
    "fake-indexeddb": "catalog:",
    "vitest": "catalog:"
  }
```

- [ ] **Step 3: `pnpm install`**

```bash
pnpm install
```

Expected: `fake-indexeddb@6.0.0` (or chosen version) がインストールされ、`pnpm-lock.yaml` が更新される。`@org/habit-sync` の node_modules に fake-indexeddb がリンクされる。

- [ ] **Step 4: `packages/habit-sync/src/test-setup.ts` 作成**

```ts
// vitest 起動時に fake-indexeddb を有効化する。
// node 環境では indexedDB が無いため、persist テストで必要。
import 'fake-indexeddb/auto';
```

- [ ] **Step 5: `packages/habit-sync/vitest.config.ts` を更新**

Read the current file first. The current `vitest.config.ts` likely uses `@org/config-vitest/node` or similar preset inlined. Add `setupFiles` to the config.

`packages/habit-sync/vitest.config.ts` の `test` ブロックに `setupFiles: ['./src/test-setup.ts']` を追加する。例:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

> **注:** 既存ファイルが `@org/config-vitest` の preset を使っている場合、preset 定義の構造を維持したまま `setupFiles` だけ追加する。Read してから差分編集すること。

- [ ] **Step 6: 動作確認**

```bash
CI=true pnpm nx test @org/habit-sync
```

Expected: 既存 4 テストが pass し続ける（setupFiles の追加で indexedDB がグローバルに使えるが、まだ実際には使っていない）。

- [ ] **Step 7: コミット**

```bash
git add pnpm-workspace.yaml packages/habit-sync/package.json packages/habit-sync/vitest.config.ts packages/habit-sync/src/test-setup.ts pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(habit-sync): fake-indexeddb を test 依存に追加

vitest の node 環境で IndexedDB API を使えるようにするため、
fake-indexeddb/auto を setup file で import する。
M5 の IndexedDB 永続化テストの土台。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `types.ts` で Row 型を抽出 + re-export

**目的:** `db-types.ts` の `Database['public']['Tables']['tasks']['Row']` のような長い型を `Task` / `TimeSlot` / `TaskLog` / `TaskStashView` という短いエイリアスにして `index.ts` から再エクスポートする。M5 以降のコンシューマー（apps/habits）が短く参照できるようにする。

**Files:**
- Create: `packages/habit-sync/src/types.ts`
- Create: `packages/habit-sync/src/types.test.ts`
- Modify: `packages/habit-sync/src/index.ts`

- [ ] **Step 1: テスト作成**

`packages/habit-sync/src/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Task, TaskLog, TaskStashView, TaskStatus, TimeSlot } from './types.js';

describe('types', () => {
  it('Task 型が必要なフィールドを持つ', () => {
    const t: Task = {
      id: 't1',
      user_id: 'u1',
      time_slot_id: 's1',
      name: 'タスク',
      frequency: { type: 'daily' },
      sort_order: 0,
      archived_at: null,
      created_at: '2026-05-16T00:00:00Z',
      updated_at: '2026-05-16T00:00:00Z',
    };
    expect(t.id).toBe('t1');
  });

  it('TimeSlot 型が必要なフィールドを持つ', () => {
    const s: TimeSlot = {
      id: 's1',
      user_id: 'u1',
      name: '朝',
      notify_at: '07:00:00',
      sort_order: 0,
      created_at: '2026-05-16T00:00:00Z',
      updated_at: '2026-05-16T00:00:00Z',
    };
    expect(s.name).toBe('朝');
  });

  it('TaskLog 型が必要なフィールドを持つ', () => {
    const l: TaskLog = {
      task_id: 't1',
      date: '2026-05-16',
      status: 'complete',
      created_at: '2026-05-16T00:00:00Z',
      updated_at: '2026-05-16T00:00:00Z',
    };
    expect(l.status).toBe('complete');
  });

  it('TaskStatus は complete/skip/fail のいずれか', () => {
    const s1: TaskStatus = 'complete';
    const s2: TaskStatus = 'skip';
    const s3: TaskStatus = 'fail';
    expect([s1, s2, s3]).toEqual(['complete', 'skip', 'fail']);
  });

  it('TaskStashView 型が VIEW の出力を表現する', () => {
    const v: TaskStashView = {
      task_id: 't1',
      user_id: 'u1',
      complete_count: 5,
      fail_count: 1,
      skip_count: 2,
      current_streak: 3,
      last_completed_date: '2026-05-15',
      task_days: 10,
      completion_rate: 0.5,
      updated_at: '2026-05-16T00:00:00Z',
    };
    expect(v.task_days).toBe(10);
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/types.test.ts
```

Expected: `./types` が見つからず fail。

- [ ] **Step 3: 実装作成**

`packages/habit-sync/src/types.ts`:

```ts
import type { Database } from './db-types.js';

// 4 テーブル / VIEW の Row 型をシンプル名で再エクスポート。
// 同期層のコンシューマー（apps/habits）はここから型を引く。

export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export type TimeSlot = Database['public']['Tables']['time_slots']['Row'];
export type TimeSlotInsert = Database['public']['Tables']['time_slots']['Insert'];
export type TimeSlotUpdate = Database['public']['Tables']['time_slots']['Update'];

export type TaskLog = Database['public']['Tables']['task_logs']['Row'];
export type TaskLogInsert = Database['public']['Tables']['task_logs']['Insert'];
export type TaskLogUpdate = Database['public']['Tables']['task_logs']['Update'];

export type TaskStashView = Database['public']['Views']['task_stash_view']['Row'];

export type TaskStatus = Database['public']['Enums']['task_status'];
```

- [ ] **Step 4: `index.ts` に re-export 追加**

`packages/habit-sync/src/index.ts` を読み、末尾に追加:

```ts
export type {
  Task,
  TaskInsert,
  TaskLog,
  TaskLogInsert,
  TaskLogUpdate,
  TaskStashView,
  TaskStatus,
  TaskUpdate,
  TimeSlot,
  TimeSlotInsert,
  TimeSlotUpdate,
} from './types.js';
```

> Biome の export 順整理に従う形で、必要に応じて既存の `export type { Database, Json }` の隣に置く。

- [ ] **Step 5: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/types.test.ts
```

Expected: 5 件 pass。

- [ ] **Step 6: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-sync/src/types.ts packages/habit-sync/src/types.test.ts packages/habit-sync/src/index.ts
git commit -m "$(cat <<'EOF'
feat(habit-sync): db-types から Row 型を抽出した types.ts を追加

Task / TimeSlot / TaskLog / TaskStashView / TaskStatus を
短いエイリアスで再エクスポートし、コンシューマー側の参照を簡潔にする。
Insert / Update バリアントも提供（書き込み側で使う）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 純粋関数 `getTodayTasksView` — 今日のタスクビュー導出

**目的:** §6.3 の 4-step 処理を純粋関数化:
1. `archived_at === null` のタスクのみ残す
2. `isDueOn(task.frequency, today, task.created_at)` が真のもののみ残す
3. `task_logs` の `(task_id, today)` で status を突合、無ければ `'empty'`
4. `time_slot_id` でグループ化、各グループ内は `sort_order` 昇順、グループ間も時間帯の `sort_order` 昇順

**Files:**
- Create: `packages/habit-sync/src/computed.ts`
- Create: `packages/habit-sync/src/computed.test.ts`

- [ ] **Step 1: テスト作成**

`packages/habit-sync/src/computed.test.ts`:

```ts
import type { Frequency } from '@org/habit-core';
import { describe, expect, it } from 'vitest';
import { getTodayTasksView } from './computed.js';
import type { Task, TaskLog, TimeSlot } from './types.js';

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'time_slot_id' | 'name'>): Task {
  return {
    user_id: 'u1',
    frequency: { type: 'daily' } satisfies Frequency,
    sort_order: 0,
    archived_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function slot(overrides: Partial<TimeSlot> & Pick<TimeSlot, 'id' | 'name' | 'sort_order'>): TimeSlot {
  return {
    user_id: 'u1',
    notify_at: '07:00:00',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function log(task_id: string, date: string, status: 'complete' | 'skip' | 'fail'): TaskLog {
  return {
    task_id,
    date,
    status,
    created_at: '2026-05-16T00:00:00Z',
    updated_at: '2026-05-16T00:00:00Z',
  };
}

describe('getTodayTasksView', () => {
  it('空配列の場合は空配列を返す', () => {
    expect(getTodayTasksView([], [], [], '2026-05-16')).toEqual([]);
  });

  it('archived_at が非 null のタスクは除外される', () => {
    const tasks: Task[] = [
      task({ id: 't1', time_slot_id: 's1', name: 'A' }),
      task({ id: 't2', time_slot_id: 's1', name: 'B', archived_at: '2026-05-15T00:00:00Z' }),
    ];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0 })];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view).toHaveLength(1);
    expect(view[0].tasks).toHaveLength(1);
    expect(view[0].tasks[0].name).toBe('A');
  });

  it('isDueOn が false のタスクは除外される（every_n_days で当日が周期外）', () => {
    const tasks: Task[] = [
      task({
        id: 't1',
        time_slot_id: 's1',
        name: '3日に1回',
        frequency: { type: 'every_n_days', n: 3, anchor: '2026-05-01' } satisfies Frequency,
        created_at: '2026-05-01',
      }),
    ];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '夜', sort_order: 0 })];
    // 2026-05-02 は anchor + 1 で周期外
    expect(getTodayTasksView(tasks, [], slots, '2026-05-02')).toEqual([]);
    // 2026-05-04 は anchor + 3 で周期内
    expect(getTodayTasksView(tasks, [], slots, '2026-05-04')[0].tasks).toHaveLength(1);
  });

  it('today の log があれば status が反映される', () => {
    const tasks: Task[] = [task({ id: 't1', time_slot_id: 's1', name: 'A' })];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0 })];
    const logs: TaskLog[] = [log('t1', '2026-05-16', 'complete')];
    const view = getTodayTasksView(tasks, logs, slots, '2026-05-16');
    expect(view[0].tasks[0].status).toBe('complete');
  });

  it('today の log がなければ status は empty', () => {
    const tasks: Task[] = [task({ id: 't1', time_slot_id: 's1', name: 'A' })];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0 })];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view[0].tasks[0].status).toBe('empty');
  });

  it('他の日付の log は今日の status に影響しない', () => {
    const tasks: Task[] = [task({ id: 't1', time_slot_id: 's1', name: 'A' })];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0 })];
    const logs: TaskLog[] = [log('t1', '2026-05-15', 'complete')];
    const view = getTodayTasksView(tasks, logs, slots, '2026-05-16');
    expect(view[0].tasks[0].status).toBe('empty');
  });

  it('time_slot_id でグループ化される', () => {
    const tasks: Task[] = [
      task({ id: 't1', time_slot_id: 's1', name: '朝A', sort_order: 0 }),
      task({ id: 't2', time_slot_id: 's1', name: '朝B', sort_order: 1 }),
      task({ id: 't3', time_slot_id: 's2', name: '夜A', sort_order: 0 }),
    ];
    const slots: TimeSlot[] = [
      slot({ id: 's1', name: '朝', sort_order: 0 }),
      slot({ id: 's2', name: '夜', sort_order: 1 }),
    ];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view).toHaveLength(2);
    expect(view[0].time_slot_id).toBe('s1');
    expect(view[0].tasks.map((t) => t.name)).toEqual(['朝A', '朝B']);
    expect(view[1].time_slot_id).toBe('s2');
    expect(view[1].tasks.map((t) => t.name)).toEqual(['夜A']);
  });

  it('各グループ内は sort_order 昇順', () => {
    const tasks: Task[] = [
      task({ id: 't1', time_slot_id: 's1', name: 'C', sort_order: 2 }),
      task({ id: 't2', time_slot_id: 's1', name: 'A', sort_order: 0 }),
      task({ id: 't3', time_slot_id: 's1', name: 'B', sort_order: 1 }),
    ];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0 })];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view[0].tasks.map((t) => t.name)).toEqual(['A', 'B', 'C']);
  });

  it('グループ間も time_slot.sort_order 昇順', () => {
    const tasks: Task[] = [
      task({ id: 't1', time_slot_id: 's2', name: '夜', sort_order: 0 }),
      task({ id: 't2', time_slot_id: 's1', name: '朝', sort_order: 0 }),
    ];
    const slots: TimeSlot[] = [
      slot({ id: 's1', name: '朝', sort_order: 0 }),
      slot({ id: 's2', name: '夜', sort_order: 1 }),
    ];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view.map((g) => g.slot_name)).toEqual(['朝', '夜']);
  });

  it('タスクが存在しない time_slot はグループから除外される', () => {
    const tasks: Task[] = [task({ id: 't1', time_slot_id: 's1', name: '朝' })];
    const slots: TimeSlot[] = [
      slot({ id: 's1', name: '朝', sort_order: 0 }),
      slot({ id: 's2', name: '夜', sort_order: 1 }),
    ];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view).toHaveLength(1);
    expect(view[0].slot_name).toBe('朝');
  });

  it('group 内の各タスクは notify_at と slot 名を持つ（UI 表示用）', () => {
    const tasks: Task[] = [task({ id: 't1', time_slot_id: 's1', name: 'A' })];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0, notify_at: '07:30:00' })];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view[0].slot_name).toBe('朝');
    expect(view[0].notify_at).toBe('07:30:00');
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/computed.test.ts
```

Expected: `./computed` が見つからず fail。

- [ ] **Step 3: 実装作成**

`packages/habit-sync/src/computed.ts`:

```ts
import { type Frequency, isDueOn } from '@org/habit-core';
import type { Task, TaskLog, TaskStatus, TimeSlot } from './types.js';

export type DisplayTaskStatus = TaskStatus | 'empty';

export interface TodayTaskItem {
  id: string;
  name: string;
  status: DisplayTaskStatus;
  sort_order: number;
}

export interface TodayTaskGroup {
  time_slot_id: string;
  slot_name: string;
  notify_at: string;
  slot_sort_order: number;
  tasks: TodayTaskItem[];
}

// §6.3 の 4-step を純粋関数化:
// 1) archived_at IS NULL でフィルタ
// 2) isDueOn(frequency, today, created_at) でフィルタ
// 3) task_logs の (task_id, today) で status を突合（無ければ 'empty'）
// 4) time_slot_id でグループ化、各グループ内 sort_order 昇順、グループ間 slot.sort_order 昇順
export function getTodayTasksView(
  tasks: Task[],
  taskLogs: TaskLog[],
  timeSlots: TimeSlot[],
  today: string,
): TodayTaskGroup[] {
  // step 1 + 2: フィルタ
  const activeTasks = tasks.filter((t) => {
    if (t.archived_at !== null) {
      return false;
    }
    // frequency は db では Json 型、ここで Frequency 判別共用体として解釈する
    return isDueOn(t.frequency as unknown as Frequency, today, t.created_at);
  });

  // step 3: log を (task_id, today) で索引化
  const logByTask = new Map<string, TaskLog>();
  for (const log of taskLogs) {
    if (log.date === today) {
      logByTask.set(log.task_id, log);
    }
  }

  // step 4: time_slot ごとにグループ化
  const slotById = new Map<string, TimeSlot>();
  for (const s of timeSlots) {
    slotById.set(s.id, s);
  }

  const tasksBySlot = new Map<string, Task[]>();
  for (const t of activeTasks) {
    const arr = tasksBySlot.get(t.time_slot_id);
    if (arr === undefined) {
      tasksBySlot.set(t.time_slot_id, [t]);
    } else {
      arr.push(t);
    }
  }

  const groups: TodayTaskGroup[] = [];
  for (const [slotId, slotTasks] of tasksBySlot.entries()) {
    const slot = slotById.get(slotId);
    if (slot === undefined) {
      continue; // 整合性エラー: slot が見つからない場合は除外
    }
    const items: TodayTaskItem[] = slotTasks
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t) => ({
        id: t.id,
        name: t.name,
        status: logByTask.get(t.id)?.status ?? 'empty',
        sort_order: t.sort_order,
      }));
    groups.push({
      time_slot_id: slotId,
      slot_name: slot.name,
      notify_at: slot.notify_at,
      slot_sort_order: slot.sort_order,
      tasks: items,
    });
  }

  return groups.sort((a, b) => a.slot_sort_order - b.slot_sort_order);
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/computed.test.ts
```

Expected: 11 件 pass。

- [ ] **Step 5: `index.ts` に re-export 追加**

`packages/habit-sync/src/index.ts` の末尾に追加:

```ts
export type { DisplayTaskStatus, TodayTaskGroup, TodayTaskItem } from './computed.js';
export { getTodayTasksView } from './computed.js';
```

- [ ] **Step 6: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
pnpm exec biome ci packages/habit-sync/src/
git add packages/habit-sync/src/computed.ts packages/habit-sync/src/computed.test.ts packages/habit-sync/src/index.ts
git commit -m "$(cat <<'EOF'
feat(habit-sync): getTodayTasksView 純粋関数を追加

§6.3 の 4-step（archived/isDueOn フィルタ、log 突合、slot グループ化）
を純粋関数化。UI hook が薄くなり、テストも node preset で 11 ケース網羅。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: IndexedDB 永続化 `persist.ts` + `configureSyncPersistence`

**目的:** legend-state の `configureObservableSync` でグローバルに `ObservablePersistIndexedDB` を設定するヘルパーを提供する。App 起動時に 1 度だけ呼ぶ想定。`databaseName` / `tableNames` / `version` をパラメータで受ける。

**Files:**
- Create: `packages/habit-sync/src/persist.ts`
- Create: `packages/habit-sync/src/persist.test.ts`

- [ ] **Step 1: テスト作成**

`packages/habit-sync/src/persist.test.ts`:

```ts
import { observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { configureSyncPersistence } from './persist.js';

// fake-indexeddb 経由で IndexedDB が利用可能
describe('configureSyncPersistence', () => {
  afterEach(() => {
    // fake-indexeddb のクリア（次のテストに影響しないように）
    // IDBFactory は @ts-ignore で reset 可能だが、各テストで個別 db を使えば不要
  });

  it('configureSyncPersistence が ObservablePersistIndexedDB を global に登録する', () => {
    // 副作用関数のため throw しないことだけ確認
    expect(() =>
      configureSyncPersistence({ databaseName: 'habits-test-1', tableNames: ['tasks'] }),
    ).not.toThrow();
  });

  it('永続化対象の observable は IndexedDB に保存されてリロード後も値が残る', async () => {
    configureSyncPersistence({ databaseName: 'habits-test-2', tableNames: ['probe'] });
    const a$ = observable({ count: 0 });
    syncObservable(a$, { persist: { name: 'probe' } });
    a$.count.set(42);

    // syncObservable が永続化を完了するまで待つ
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 新しい observable に同じ name を渡すと IndexedDB から復元される
    const b$ = observable({ count: 0 });
    syncObservable(b$, { persist: { name: 'probe' } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(b$.count.get()).toBe(42);
  });
});
```

> **注:** legend-state の sync API は非同期で永続化される。テストで `setTimeout` 50ms 待ちは fake-indexeddb の特性によりほぼ即座に解決される。flake が出る場合は 100ms に増やす。

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/persist.test.ts
```

Expected: `./persist` が見つからず fail。

- [ ] **Step 3: 実装作成**

`packages/habit-sync/src/persist.ts`:

```ts
import { configureSynced } from '@legendapp/state/sync';
import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb';

export interface SyncPersistenceConfig {
  databaseName: string;
  tableNames: string[];
  version?: number;
}

// IndexedDB 永続化を global に登録する。アプリ起動時に 1 度だけ呼ぶ。
// 各 observable の persist.name と tableNames を一致させること。
export function configureSyncPersistence(config: SyncPersistenceConfig): void {
  configureSynced({
    persist: {
      plugin: new ObservablePersistIndexedDB({
        databaseName: config.databaseName,
        version: config.version ?? 1,
        tableNames: config.tableNames,
      }),
    },
  });
}
```

> **注:** `configureSynced` は global 状態を変更する。テストで複数呼び出すとお互いを上書きするため、各テストで database 名を変えて独立化する。

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/persist.test.ts
```

Expected: 2 件 pass。

> **fail した場合のデバッグ手順:**
> - `configureSynced` の import パスが間違っていないか確認: `@legendapp/state/sync`
> - `ObservablePersistIndexedDB` の import パス: `@legendapp/state/persist-plugins/indexeddb`
> - `syncObservable` API が beta バージョンで存在するか確認: `node_modules/.pnpm/@legendapp+state@.../@legendapp/state/sync.d.ts` で `declare function syncObservable` を grep
> - `syncObservable` が無い場合は `linked()` や `observable(linked({...}))` パターンを使う（同じ機能、API 名違い）

- [ ] **Step 5: `index.ts` に re-export 追加**

`packages/habit-sync/src/index.ts` の末尾に追加:

```ts
export type { SyncPersistenceConfig } from './persist.js';
export { configureSyncPersistence } from './persist.js';
```

- [ ] **Step 6: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-sync/src/persist.ts packages/habit-sync/src/persist.test.ts packages/habit-sync/src/index.ts
git commit -m "$(cat <<'EOF'
feat(habit-sync): IndexedDB 永続化 configureSyncPersistence を追加

legend-state の configureSynced + ObservablePersistIndexedDB を
ラップした薄いヘルパー。アプリ起動時に 1 度だけ呼ぶ。
fake-indexeddb 経由でテスト可能。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `online.ts` — オンライン状態の observable

**目的:** `navigator.onLine` を読みつつ `online` / `offline` イベントを購読する observable を提供。M8 の `PendingSyncBadge` と組み合わせて UI が「同期前」表示を出すための土台。

**Files:**
- Create: `packages/habit-sync/src/online.ts`
- Create: `packages/habit-sync/src/online.test.ts`

> **テスト戦略:** `navigator` は node 環境に存在しないため、`globalThis.navigator` をスタブして観察する。`window` も同様。`vi.stubGlobal` を使う。

- [ ] **Step 1: テスト作成**

`packages/habit-sync/src/online.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 各テスト前にモジュール状態をリセットするため、dynamic import で取得する
type OnlineModule = typeof import('./online.js');

describe('online$ observable', () => {
  let listeners: Map<string, EventListener>;

  beforeEach(() => {
    listeners = new Map();
    // window と navigator を最小限スタブ
    vi.stubGlobal('window', {
      addEventListener: (type: string, cb: EventListener) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    });
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('初期値は navigator.onLine に従う (true)', async () => {
    const { online$, startOnlineWatcher } = (await import('./online.js')) as OnlineModule;
    startOnlineWatcher();
    expect(online$.get()).toBe(true);
  });

  it('初期値が navigator.onLine=false なら false', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { online$, startOnlineWatcher } = (await import('./online.js')) as OnlineModule;
    startOnlineWatcher();
    expect(online$.get()).toBe(false);
  });

  it('offline イベントで online$ が false になる', async () => {
    const { online$, startOnlineWatcher } = (await import('./online.js')) as OnlineModule;
    startOnlineWatcher();
    expect(online$.get()).toBe(true);
    listeners.get('offline')?.(new Event('offline'));
    expect(online$.get()).toBe(false);
  });

  it('online イベントで online$ が true になる', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { online$, startOnlineWatcher } = (await import('./online.js')) as OnlineModule;
    startOnlineWatcher();
    expect(online$.get()).toBe(false);
    listeners.get('online')?.(new Event('online'));
    expect(online$.get()).toBe(true);
  });

  it('startOnlineWatcher は unsubscribe 関数を返し、呼ぶと listener が解除される', async () => {
    const { startOnlineWatcher } = (await import('./online.js')) as OnlineModule;
    const stop = startOnlineWatcher();
    expect(listeners.size).toBeGreaterThan(0);
    stop();
    expect(listeners.size).toBe(0);
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/online.test.ts
```

- [ ] **Step 3: 実装作成**

`packages/habit-sync/src/online.ts`:

```ts
import { observable } from '@legendapp/state';

// オンライン状態の observable。
// アプリ起動時に startOnlineWatcher() を 1 度だけ呼ぶ想定。
// SSR / node 環境で navigator が無い場合は常に true として扱う（保守的に同期可能と仮定）。
export const online$ = observable<boolean>(true);

// window / navigator が無い環境（SSR / 純 Node）では何もしないでフォールバック。
function hasBrowserGlobals(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

export function startOnlineWatcher(): () => void {
  if (!hasBrowserGlobals()) {
    return () => {};
  }
  // 初期値を navigator.onLine に同期
  online$.set(navigator.onLine);

  const onOnline = (): void => {
    online$.set(true);
  };
  const onOffline = (): void => {
    online$.set(false);
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/online.test.ts
```

Expected: 5 件 pass。

- [ ] **Step 5: `index.ts` に re-export 追加**

`packages/habit-sync/src/index.ts` の末尾に追加:

```ts
export { online$, startOnlineWatcher } from './online.js';
```

- [ ] **Step 6: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-sync/src/online.ts packages/habit-sync/src/online.test.ts packages/habit-sync/src/index.ts
git commit -m "$(cat <<'EOF'
feat(habit-sync): online$ observable + startOnlineWatcher

navigator.onLine + online/offline イベントで online$ を同期する。
SSR / node では常に true フォールバック。
M8 の PendingSyncBadge / オフライン UI で消費する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `observables.ts` — state$ の型を Row 形式に拡張

**目的:** M3 で「型骨格のみ」だった `state$.{time_slots, tasks, task_logs}: Record<string, unknown>` を、`Record<string, Row>` 形式に整える。`task_stash_view` も追加する。同期は次の Task 7 で接続するため、ここでは型と空オブジェクト初期化のみ。

**Files:**
- Modify: `packages/habit-sync/src/observables.ts`
- Modify: `packages/habit-sync/src/index.test.ts`

- [ ] **Step 1: 既存テストを読み、想定される影響を確認**

`packages/habit-sync/src/index.test.ts` を read。`state$.user.set(...)` を呼んでいるテストがあり、`task_logs` 等は触っていない。型変更で破壊されないか確認。

- [ ] **Step 2: `observables.ts` を更新**

`packages/habit-sync/src/observables.ts` の全内容を以下に置き換える:

```ts
import { observable } from '@legendapp/state';
import type { User } from '@supabase/supabase-js';
import type { Task, TaskLog, TaskStashView, TimeSlot } from './types.js';

// 同期 observable の root。
// 各テーブル / VIEW は id 引きの Record として保持。
// 実体への syncedSupabase 接続は setupSync() で行う（Task 7）。
export const state$ = observable<SyncStateShape>({
  user: null,
  time_slots: {},
  tasks: {},
  task_logs: {},
  task_stash_view: {},
});

export interface SyncStateShape {
  user: User | null;
  time_slots: Record<string, TimeSlot>;
  tasks: Record<string, Task>;
  task_logs: Record<string, TaskLog>; // key は `${task_id}-${date}` 形式
  task_stash_view: Record<string, TaskStashView>;
}

export type SyncState = typeof state$;
```

> **`task_logs` のキー設計:** Supabase 側のテーブルは複合 PK (`task_id`, `date`)。legend-state の Record は単一文字列キーなので `${task_id}-${date}` で結合する。`syncedSupabase` の `fieldId` オプションで結合キーを指定する（Task 7 で設定）。

- [ ] **Step 3: 既存テストの修正**

`index.test.ts` の `state$.user.set(...)` テストはそのまま動くはず。型を確認するためのスモークテストを 1 件追加:

`packages/habit-sync/src/index.test.ts` の `describe` ブロック内の最後（`it('NotificationProvider インターフェースを実装できる', ...)` の後）に追加:

```ts
  it('state$ の各テーブルが Record 形式で初期化される', () => {
    expect(state$.time_slots.get()).toEqual({});
    expect(state$.tasks.get()).toEqual({});
    expect(state$.task_logs.get()).toEqual({});
    expect(state$.task_stash_view.get()).toEqual({});
  });
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-sync
```

Expected: 既存 4 + 新規 1 = 5 件 pass、加えて Task 2-5 で追加したテストも全 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-sync/src/observables.ts packages/habit-sync/src/index.test.ts
git commit -m "$(cat <<'EOF'
feat(habit-sync): state$ の型を Row 形式の Record に拡張

time_slots / tasks / task_logs / task_stash_view を各 Row 型の
Record<string, Row> として宣言。task_logs のキーは ${task_id}-${date}。
実体への syncedSupabase 接続は次タスクで実装。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `sync.ts` — 4 テーブルを `syncedSupabase` に接続

**目的:** `setupSync(state$, client, options)` で `state$.time_slots` / `tasks` / `task_logs` / `task_stash_view` を `syncedSupabase` に接続。Realtime 有効、task_logs は直近 31 日 filter、task_stash_view は read-only。

**Files:**
- Create: `packages/habit-sync/src/sync.ts`
- Create: `packages/habit-sync/src/sync.test.ts`

> **テスト戦略:** `syncedSupabase` 自体は黒箱として扱い、`setupSync` が呼ばれたときに 4 つの observable に対して syncObservable が走ることだけを確認する。具体的には mock した `SupabaseClient` を渡し、syncedSupabase が呼ばれた回数や引数を検証する。

- [ ] **Step 1: テスト作成**

`packages/habit-sync/src/sync.test.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTaskLogsCutoffDate, setupSync } from './sync.js';

describe('getTaskLogsCutoffDate', () => {
  it('today から 31 日前の YYYY-MM-DD を返す', () => {
    expect(getTaskLogsCutoffDate('2026-05-16')).toBe('2026-04-15');
  });

  it('月跨ぎでも 31 日前を計算する', () => {
    expect(getTaskLogsCutoffDate('2026-02-15')).toBe('2026-01-15');
  });

  it('年跨ぎでも 31 日前を計算する', () => {
    expect(getTaskLogsCutoffDate('2026-01-15')).toBe('2025-12-15');
  });
});

describe('setupSync', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('SupabaseClient を受け取って例外なく実行できる', async () => {
    // observables.ts の state$ を fresh import するためにモジュールリセット
    const { state$ } = await import('./observables.js');
    const fakeClient = {
      auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    } as unknown as SupabaseClient;

    expect(() => setupSync(state$, fakeClient, { today: '2026-05-16' })).not.toThrow();
  });

  it('state$.tasks / task_logs / time_slots / task_stash_view が Record として残る', async () => {
    const { state$ } = await import('./observables.js');
    const fakeClient = {
      auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    } as unknown as SupabaseClient;
    setupSync(state$, fakeClient, { today: '2026-05-16' });

    // syncedSupabase 接続後も Record として読める（初期値は空）
    expect(typeof state$.tasks.get()).toBe('object');
    expect(typeof state$.time_slots.get()).toBe('object');
    expect(typeof state$.task_logs.get()).toBe('object');
    expect(typeof state$.task_stash_view.get()).toBe('object');
  });
});
```

> **注:** `syncedSupabase` の挙動そのものは検証しない（ライブラリ責務）。`setupSync` が「呼んでも壊れない」「state$ が依然 Record として動く」ことだけ確認する。本格的な楽観更新テストは Task 10 の任意の integration test で行う。

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/sync.test.ts
```

- [ ] **Step 3: 実装作成**

`packages/habit-sync/src/sync.ts`:

```ts
import { syncObservable } from '@legendapp/state/sync';
import { syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toUtcDays } from '@org/habit-core';
import type { SyncStateShape } from './observables.js';
import type { Observable } from '@legendapp/state';

export interface SetupSyncOptions {
  today: string; // 'YYYY-MM-DD' — task_logs の filter cutoff 計算に使う
}

// today から 31 日前の日付文字列を返す（task_logs の初期 filter 範囲）。
export function getTaskLogsCutoffDate(today: string): string {
  const days = toUtcDays(today) - 31;
  const ms = days * 86_400_000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// state$ の 4 テーブル / VIEW を syncedSupabase で双方向同期に接続する。
// アプリ起動時に 1 度だけ呼ぶ想定。
export function setupSync(
  state$: Observable<SyncStateShape>,
  client: SupabaseClient,
  options: SetupSyncOptions,
): void {
  const cutoff = getTaskLogsCutoffDate(options.today);

  // time_slots: 全件同期、Realtime ON
  syncObservable(
    state$.time_slots,
    syncedSupabase({
      supabase: client,
      collection: 'time_slots',
      realtime: true,
      persist: { name: 'time_slots' },
    }),
  );

  // tasks: 全件同期、Realtime ON
  syncObservable(
    state$.tasks,
    syncedSupabase({
      supabase: client,
      collection: 'tasks',
      realtime: true,
      persist: { name: 'tasks' },
    }),
  );

  // task_logs: 直近 31 日のみ初期ロード、Realtime ON
  // 複合 PK (task_id, date) なので fieldId で結合キーを生成
  syncObservable(
    state$.task_logs,
    syncedSupabase({
      supabase: client,
      collection: 'task_logs',
      realtime: true,
      filter: (q) => q.gte('date', cutoff),
      persist: { name: 'task_logs' },
      fieldId: 'task_id',
    }),
  );

  // task_stash_view: VIEW のため read-only、Realtime ON
  syncObservable(
    state$.task_stash_view,
    syncedSupabase({
      supabase: client,
      collection: 'task_stash_view',
      realtime: true,
      actions: ['read'],
      persist: { name: 'task_stash_view' },
      fieldId: 'task_id',
    }),
  );
}
```

> **`fieldId` についての注意:** `task_logs` の複合 PK (`task_id`, `date`) を `syncedSupabase` の単一文字列キーに変換する必要がある。legend-state v3 の `syncedSupabase` は `fieldId` で id 抽出ができるが、複合 PK のサポートは不安定なので、**fieldId に `'task_id'` を指定して同一 task の最新ログのみ表示**することで暫定回避する。完全な複合キー対応は M9（履歴画面）で実装する。
>
> 実装時にこれが動かない場合は、`fieldId` を関数 `(row) => `${row.task_id}-${row.date}`` で渡せるか試す。それでも動かない場合は task_logs を `Record<string, TaskLog[]>` （task_id ごとの配列）に変更してアプリ層で日付フィルタする方針に切り替える。

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/sync.test.ts
```

Expected: getTaskLogsCutoffDate 3 件 + setupSync 2 件 = 5 件 pass。

> **`setupSync` で fail する場合:**
> - `syncObservable` または `syncedSupabase` のインポートパスを確認
> - `fieldId` が型エラーになる場合は一旦削除して running を優先（M9 で対応）
> - `realtime: true` が型エラーなら `realtime: { schema: 'public' }` の object 形式に変える

- [ ] **Step 5: `index.ts` に re-export 追加**

```ts
export type { SetupSyncOptions } from './sync.js';
export { getTaskLogsCutoffDate, setupSync } from './sync.js';
```

- [ ] **Step 6: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-sync/src/sync.ts packages/habit-sync/src/sync.test.ts packages/habit-sync/src/index.ts
git commit -m "$(cat <<'EOF'
feat(habit-sync): setupSync で 4 テーブルを syncedSupabase に接続

time_slots / tasks / task_logs / task_stash_view を双方向同期。
task_logs は今日から 31 日前まで、task_stash_view は read-only。
全テーブル Realtime 有効。アプリ起動時に 1 度だけ呼ぶ想定。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `pending-sync.ts` — pending writes 件数の observable

**目的:** legend-state の `syncState(state$.tasks)` 等を購読して、pending な書き込みの合計件数を返すヘルパーを提供する。M8 の `PendingSyncBadge` UI で消費する。

**Files:**
- Create: `packages/habit-sync/src/pending-sync.ts`
- Create: `packages/habit-sync/src/pending-sync.test.ts`

- [ ] **Step 1: テスト作成**

`packages/habit-sync/src/pending-sync.test.ts`:

```ts
import { observable } from '@legendapp/state';
import { describe, expect, it } from 'vitest';
import { getPendingSyncCount } from './pending-sync.js';

describe('getPendingSyncCount', () => {
  it('同期未接続の observable では 0 を返す', () => {
    const s$ = observable({
      tasks: {} as Record<string, unknown>,
      time_slots: {} as Record<string, unknown>,
      task_logs: {} as Record<string, unknown>,
    });
    expect(getPendingSyncCount(s$)).toBe(0);
  });

  it('観測対象キーが無い state$ でも 0 を返す（防御的）', () => {
    // sync 接続無し
    const s$ = observable({});
    expect(getPendingSyncCount(s$ as never)).toBe(0);
  });
});
```

> **テストの限界:** 実際の `numPendingSets` を再現するには `syncedSupabase` 接続が必要で、それは Task 10 の任意 integration test に任せる。ここでは「未接続時は 0 を返す」だけ確認する。

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/pending-sync.test.ts
```

- [ ] **Step 3: 実装作成**

`packages/habit-sync/src/pending-sync.ts`:

```ts
import { syncState } from '@legendapp/state';
import type { Observable } from '@legendapp/state';
import type { SyncStateShape } from './observables.js';

// state$ 配下の sync 対象キーを横断して pending な書き込み件数の合計を返す。
// 未接続のキーは 0 として扱う。
const SYNCED_KEYS = ['tasks', 'time_slots', 'task_logs'] as const;

export function getPendingSyncCount(state$: Observable<SyncStateShape>): number {
  let total = 0;
  for (const key of SYNCED_KEYS) {
    try {
      const sync = syncState((state$ as unknown as Record<string, Observable<unknown>>)[key]);
      const pending = sync.numPendingSets?.get();
      if (typeof pending === 'number') {
        total += pending;
      }
    } catch {
      // syncObservable 未接続のキーは syncState が throw する可能性がある → 無視して 0 扱い
    }
  }
  return total;
}
```

> **注意:** legend-state v3 beta の `syncState` API の挙動は変動する可能性がある。`numPendingSets` が undefined を返す場合や、`syncState` が常に observable を返して throw しない場合もある。実装時に node_modules/.pnpm/@legendapp+state@.../sync.d.ts を確認すること。

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/pending-sync.test.ts
```

Expected: 2 件 pass。

- [ ] **Step 5: `index.ts` に re-export 追加**

```ts
export { getPendingSyncCount } from './pending-sync.js';
```

- [ ] **Step 6: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-sync/src/pending-sync.ts packages/habit-sync/src/pending-sync.test.ts packages/habit-sync/src/index.ts
git commit -m "$(cat <<'EOF'
feat(habit-sync): getPendingSyncCount で pending 件数を取得

syncState() 経由で各テーブルの numPendingSets を合算。
未接続キーは 0 として扱う防御的実装。
M8 の PendingSyncBadge で消費する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `apps/habits/src/hooks/useTodayTasks.ts`

**目的:** `state$` の `tasks` / `task_logs` / `time_slots` を購読し、`getTodayTasksView` の結果を React コンポーネントに返すフック。`today` は呼び出し時の日付（Asia/Tokyo ローカル）。

**Files:**
- Create: `apps/habits/src/hooks/useTodayTasks.ts`
- Create: `apps/habits/src/hooks/useTodayTasks.test.tsx`

- [ ] **Step 1: テスト作成**

`apps/habits/src/hooks/useTodayTasks.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { state$, type Task, type TaskLog, type TimeSlot } from '@org/habit-sync';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTodayTasks } from './useTodayTasks.js';

function task(t: Partial<Task> & Pick<Task, 'id' | 'time_slot_id' | 'name'>): Task {
  return {
    user_id: 'u1',
    frequency: { type: 'daily' },
    sort_order: 0,
    archived_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01T00:00:00Z',
    ...t,
  };
}

function slot(s: Partial<TimeSlot> & Pick<TimeSlot, 'id' | 'name' | 'sort_order'>): TimeSlot {
  return {
    user_id: 'u1',
    notify_at: '07:00:00',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...s,
  };
}

describe('useTodayTasks', () => {
  beforeEach(() => {
    state$.tasks.set({});
    state$.task_logs.set({});
    state$.time_slots.set({});
  });

  it('state が空のときは空配列を返す', () => {
    const { result } = renderHook(() => useTodayTasks('2026-05-16'));
    expect(result.current).toEqual([]);
  });

  it('state にタスクと slot を設定すると today のビューを返す', () => {
    state$.tasks.set({
      t1: task({ id: 't1', time_slot_id: 's1', name: '歯磨き' }),
    });
    state$.time_slots.set({
      s1: slot({ id: 's1', name: '朝', sort_order: 0 }),
    });
    const { result } = renderHook(() => useTodayTasks('2026-05-16'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].slot_name).toBe('朝');
    expect(result.current[0].tasks).toHaveLength(1);
    expect(result.current[0].tasks[0].name).toBe('歯磨き');
    expect(result.current[0].tasks[0].status).toBe('empty');
  });

  it('today の log が status に反映される', () => {
    state$.tasks.set({
      t1: task({ id: 't1', time_slot_id: 's1', name: '歯磨き' }),
    });
    state$.time_slots.set({
      s1: slot({ id: 's1', name: '朝', sort_order: 0 }),
    });
    state$.task_logs.set({
      't1-2026-05-16': {
        task_id: 't1',
        date: '2026-05-16',
        status: 'complete',
        created_at: '2026-05-16T00:00:00Z',
        updated_at: '2026-05-16T00:00:00Z',
      } satisfies TaskLog,
    });
    const { result } = renderHook(() => useTodayTasks('2026-05-16'));
    expect(result.current[0].tasks[0].status).toBe('complete');
  });
});
```

- [ ] **Step 2: 失敗確認

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/hooks/useTodayTasks.test.tsx
```

- [ ] **Step 3: 実装作成**

`apps/habits/src/hooks/useTodayTasks.ts`:

```ts
import { use$ } from '@legendapp/state/react';
import { getTodayTasksView, state$, type TodayTaskGroup } from '@org/habit-sync';

// 今日のタスクビューを返す React フック。
// state$ の tasks / task_logs / time_slots を購読し、変更時に再評価される。
// today は呼び出し側が決定（タイムゾーンに依存するため）。
export function useTodayTasks(today: string): TodayTaskGroup[] {
  return use$(() => {
    const tasks = Object.values(state$.tasks.get());
    const taskLogs = Object.values(state$.task_logs.get());
    const timeSlots = Object.values(state$.time_slots.get());
    return getTodayTasksView(tasks, taskLogs, timeSlots, today);
  });
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/hooks/useTodayTasks.test.tsx
```

Expected: 3 件 pass。

> **fail する場合:**
> - `use$` のインポートパス: `@legendapp/state/react`
> - state$ の型が `Record<string, Task>` であることを確認（Task 6 完了済み）
> - `Object.values` がリアクティブに動かない場合は、`state$.tasks.get()` の代わりに `state$.tasks.peek()` を試す、または `useSelector` を使う

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/hooks/useTodayTasks.ts apps/habits/src/hooks/useTodayTasks.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): useTodayTasks フックで今日のタスクビューを購読

state$ の tasks / task_logs / time_slots を use$ で購読し、
getTodayTasksView の結果を返す。M6 の Today.tsx で消費する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: `useSyncBootstrap` で App 起動時に同期初期化

**目的:** `configureSyncPersistence` → `setupSync` → `startOnlineWatcher` の順序で初期化するフックを `App.tsx` で呼ぶ。認証完了後（`state$.user` が非 null になった後）にのみ sync 接続したいので、`useAuthSession` の動作と協調する。

**Files:**
- Create: `apps/habits/src/hooks/useSyncBootstrap.ts`
- Create: `apps/habits/src/hooks/useSyncBootstrap.test.tsx`
- Modify: `apps/habits/src/App.tsx`
- Modify: `apps/habits/src/App.test.tsx`

- [ ] **Step 1: テスト作成**

`apps/habits/src/hooks/useSyncBootstrap.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const configureSyncPersistenceMock = vi.fn();
const setupSyncMock = vi.fn();
const startOnlineWatcherMock = vi.fn().mockReturnValue(() => {});

vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    configureSyncPersistence: (...args: unknown[]): unknown => configureSyncPersistenceMock(...args),
    setupSync: (...args: unknown[]): unknown => setupSyncMock(...args),
    startOnlineWatcher: (...args: unknown[]): unknown => startOnlineWatcherMock(...args),
  };
});

vi.mock('../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({}),
}));

import { useSyncBootstrap } from './useSyncBootstrap.js';

describe('useSyncBootstrap', () => {
  beforeEach(() => {
    configureSyncPersistenceMock.mockReset();
    setupSyncMock.mockReset();
    startOnlineWatcherMock.mockReset();
    startOnlineWatcherMock.mockReturnValue(() => {});
  });

  it('マウント時に configureSyncPersistence と startOnlineWatcher を呼ぶ', () => {
    renderHook(() => useSyncBootstrap());
    expect(configureSyncPersistenceMock).toHaveBeenCalledTimes(1);
    expect(startOnlineWatcherMock).toHaveBeenCalledTimes(1);
  });

  it('マウント時に setupSync を呼ぶ（today を渡す）', () => {
    renderHook(() => useSyncBootstrap());
    expect(setupSyncMock).toHaveBeenCalledTimes(1);
    const call = setupSyncMock.mock.calls[0];
    // 第 3 引数の options に today が含まれる
    expect(call[2]).toMatchObject({ today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it('unmount で startOnlineWatcher の cleanup が呼ばれる', () => {
    const cleanup = vi.fn();
    startOnlineWatcherMock.mockReturnValue(cleanup);
    const { unmount } = renderHook(() => useSyncBootstrap());
    unmount();
    expect(cleanup).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/hooks/useSyncBootstrap.test.tsx
```

- [ ] **Step 3: 実装作成**

`apps/habits/src/hooks/useSyncBootstrap.ts`:

```ts
import { configureSyncPersistence, setupSync, startOnlineWatcher, state$ } from '@org/habit-sync';
import { useEffect } from 'react';
import { getAppSupabase } from '../lib/supabase.js';

// アプリ起動時に同期レイヤーを初期化する。
// 1) IndexedDB 永続化を設定
// 2) navigator.onLine 監視を開始
// 3) 4 テーブルを syncedSupabase に接続
// App.tsx で 1 度だけ呼ぶ想定。
export function useSyncBootstrap(): void {
  useEffect(() => {
    configureSyncPersistence({
      databaseName: 'habits-cache',
      tableNames: ['tasks', 'time_slots', 'task_logs', 'task_stash_view'],
    });

    const stopOnlineWatcher = startOnlineWatcher();

    // today はクライアントローカル日付（YYYY-MM-DD）
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    setupSync(state$, getAppSupabase(), { today });

    return () => {
      stopOnlineWatcher();
    };
  }, []);
}
```

- [ ] **Step 4: `App.tsx` を更新**

`apps/habits/src/App.tsx` を以下に置き換える:

```tsx
import { RouterProvider } from '@tanstack/react-router';
import { useAuthSession } from './hooks/useAuthSession.js';
import { useSyncBootstrap } from './hooks/useSyncBootstrap.js';
import { router } from './router.js';

export default function App(): React.ReactElement {
  useAuthSession();
  useSyncBootstrap();
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 5: `App.test.tsx` の mock を更新**

Read `apps/habits/src/App.test.tsx`. The current file mocks `./lib/auth.js` and `./lib/supabase.js`. Add mock for `@org/habit-sync` to silence `useSyncBootstrap`:

`apps/habits/src/App.test.tsx` の既存 mock ブロックの後に追加（既存の `vi.mock('./lib/supabase.js', ...)` の下）:

```ts
vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    configureSyncPersistence: vi.fn(),
    setupSync: vi.fn(),
    startOnlineWatcher: vi.fn().mockReturnValue(() => {}),
  };
});
```

- [ ] **Step 6: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits
```

Expected: useSyncBootstrap.test 3 件 + 既存 App.test 5 件 + その他のテスト全 pass。

- [ ] **Step 7: 全体検証 + コミット**

```bash
CI=true pnpm nx run-many -t typecheck lint test --skip-nx-cache
pnpm exec biome ci .
```

Expected: 全プロジェクト緑。

```bash
git add apps/habits/src/hooks/useSyncBootstrap.ts apps/habits/src/hooks/useSyncBootstrap.test.tsx apps/habits/src/App.tsx apps/habits/src/App.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): useSyncBootstrap で App 起動時に同期を初期化

configureSyncPersistence → startOnlineWatcher → setupSync の順で起動。
today はクライアントローカル日付を YYYY-MM-DD で計算。
App.tsx で useAuthSession の隣に追加。
App.test.tsx は @org/habit-sync の 3 関数を mock。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: (任意) Supabase ローカル統合確認

**目的:** ローカル Supabase + dev サーバーで実際に同期動作を確認する。サインアップ → /today で初期 6 タスクが表示される → DevTools で `state$.tasks.get()` を確認できる、というシナリオ。Docker 依存のため自動化はしないがプランに残す。

**Files:**
- (新規作成なし、手動検証のみ。CLAUDE.md に同期の運用メモを追記)

- [ ] **Step 1: 環境準備**

```bash
supabase start
supabase db reset
```

- [ ] **Step 2: dev サーバー起動**

```bash
pnpm nx serve habits
```

ブラウザで `http://localhost:5173/auth/signup` → 新規登録 → `/today` 着地。

- [ ] **Step 3: DevTools で state$ を観察**

ブラウザの DevTools → Console で:

```js
// legend-state は window に exposeしない設計のため、
// state$.tasks.get() を観察するには apps/habits の dev ビルドで globalThis に attach する必要がある。
// 開発時のみ App.tsx で globalThis.state$ = state$ を仕込むことを検討（本タスクで実施するかは判断）。
```

> **観察手段の代替案:** Supabase Studio (http://localhost:54323) で `tasks` テーブルを直接確認、または React DevTools で `useTodayTasks` の返り値を観察する。

- [ ] **Step 4: 楽観更新確認**

`/today` ページが M6 で実装されるまで完全な E2E はできないが、Console から state を直接書き換えて Supabase に反映されることを確認できる:

```js
// dev で globalThis.state$ を仕込んだ場合:
state$.tasks['(任意のtaskId)'].name.set('新しい名前');
// Studio で対応するタスクの名前が変わることを確認。
```

- [ ] **Step 5: オフライン → 再接続テスト**

DevTools の Network タブで Offline に切り替え → state を書き換え → Online に戻す → 反映されることを確認。

- [ ] **Step 6: CLAUDE.md に M5 メモを追記**

`/Users/ikomiki/workspace/daily-task/CLAUDE.md` の `### 認証フロー（M3 以降）` セクションの後に追加:

```markdown

### 同期レイヤー（M5 以降）

- `packages/habit-sync` の `state$` が legend-state + syncedSupabase で双方向同期
- 永続化は IndexedDB (`habits-cache` データベース)。オフライン書き込みは retry queue に滞留 → 復帰時に自動再送
- `task_logs` は初期ロード時に直近 31 日のみ取得（M9 で履歴遅延ロードを追加予定）
- `task_stash_view` は read-only（書き込みはトリガー経由）
- `useTodayTasks(today)` で今日のタスクビューを購読、`getPendingSyncCount(state$)` で pending 件数を取得
- `online$` で `navigator.onLine` を observable 化
```

- [ ] **Step 7: コミット**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: CLAUDE.md に M5 同期レイヤーの運用メモを追記

state$ 構造、IndexedDB 永続化、task_logs の 31 日 filter、
task_stash_view の read-only、useTodayTasks / online$ の用途
を簡潔にメモ。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

> **このタスクをスキップする判断:** Docker や Supabase CLI が環境に無い場合、Task 11 全体をスキップして M5 を終了して問題ない（仕様 §6.1 の動作確認は M6 の Today 画面実装後に正式に行えるため）。

---

## 次のマイルストーン

このプラン完了後、次は **M6: Today 画面** の実装プランを `docs/superpowers/plans/2026-05-16-habits-app-m6-today.md` として作成する。M6 で扱う内容:

- `apps/habits/src/features/today/Today.tsx` を本実装に置き換え（現状は placeholder）
- `useTodayTasks` の返り値を `TodayView` / `TimeSlotGroup` / `TodayTaskItem` のコンポーネントで描画
- 各タスクの右側に `StatusButtons`（完了・スキップ・失敗の 3 ボタン）
- ボタン押下 → `state$.task_logs['${task_id}-${today}'].set({status})` で楽観更新
- ローディング状態（`syncState(state$.tasks).isLoaded` で判定）

---

## 自己レビュー結果

仕様カバレッジ（§5.1 / §6.1 / §6.3 / §7.1）:

- ✅ §5.1 テーブル → Task 2 で Row 型抽出、Task 6 で state$ Record 化
- ✅ §6.1 syncedSupabase 4 テーブル接続 → Task 7
- ✅ §6.1 IndexedDB persist → Task 4
- ✅ §6.1 task_logs 31 日 filter → Task 7 の `getTaskLogsCutoffDate`
- ✅ §6.1 task_stash_view read-only → Task 7 の `actions: ['read']`
- ✅ §6.1 retry queue 件数監視 → Task 8 `getPendingSyncCount`
- ✅ §6.3 今日のタスク導出 4-step → Task 3 `getTodayTasksView`
- ✅ §6.3 status: 'empty' フォールバック → Task 3
- ✅ §6.3 time_slot_id グループ化 → Task 3
- ✅ §7.1 navigator.onLine 監視 → Task 5
- ✅ §7.1 オフライン書き込みキュー → Task 4 (IndexedDB) + Task 7 (syncedSupabase の retry queue)
- ✅ M6 以降が消費できるフック → Task 9 (useTodayTasks)、Task 10 (useSyncBootstrap)

型整合性:

- `Task` / `TimeSlot` / `TaskLog` / `TaskStashView` 型は Task 2 で定義、後続のすべての Task で同じ名前で使用
- `SyncStateShape` は Task 6 で定義、Task 7 / 9 / 10 でその型を参照
- `TodayTaskGroup` / `TodayTaskItem` は Task 3 で定義、Task 9 で参照
- `getTaskLogsCutoffDate(today: string): string` の戻り値型は Task 7 内で一貫
- `getPendingSyncCount(state$): number` のシグネチャは Task 8 で定義、後続未参照（M6 以降が消費）

プレースホルダ:

- なし。すべてのテスト / 実装 / コマンド / mock が具体的記述。
- Task 4 と Task 7 にライブラリ API の不確実性についての fallback 手順を明記（v3 beta のため）。

リスク（実装時に注意）:

- **legend-state v3 beta の API 変動:** `syncObservable` vs `linked` vs `observable(linked(...))`、`syncState().numPendingSets` 等のフィールド名。実装時に `.d.ts` を確認する手順を各 Task の "fail した場合" コメントに記載済み。
- **task_logs の複合 PK:** `fieldId: 'task_id'` で暫定回避（同一 task の最新 log のみ表示）。完全対応は M9。Task 7 にその旨明記。
- **`@org/habit-sync` の vitest 設定:** setupFiles を Task 1 で追加。これにより既存テストの動作が変わらないことを確認済み（fake-indexeddb は global を polyfill するだけ）。
