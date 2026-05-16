# Habits App — M7: タスク管理 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設計仕様 `docs/superpowers/specs/2026-05-16-habits-app-design.md` §6.2 / §5.2 のタスク管理機能を完成させ、`/tasks` で既存タスクの CRUD（追加 / 編集 / アーカイブ / 復元）、`/settings/time-slots` で時間帯の CRUD（最低 1 個は残す）、Today 画面ヘッダーから両画面への導線を提供する。頻度ルール 5 type すべてを GUI で編集できる `FrequencyPicker` を中核に据える。

**Architecture:** 書き込みは `packages/habit-sync` 側に `createTask` / `updateTask` / `archiveTask` / `unarchiveTask` / `createTimeSlot` / `updateTimeSlot` / `deleteTimeSlot` の純粋関数を集約し、UUID 生成と `state$` への楽観更新を 1 箇所にまとめる。`apps/habits` 側は `features/task/{FrequencyPicker, TaskForm, TaskCard, TaskList}.tsx` と `features/timeslot/{TimeSlotEditor, TimeSlotList}.tsx`、`routes/tasks/{TasksPage, TaskNewPage, TaskEditPage}.tsx`、`routes/settings/SettingsTimeSlotsPage.tsx` でルートとフォームを実装。Today 画面ヘッダーに /tasks と /settings/time-slots へのリンクを追加する。

**Tech Stack:** React 19 / TanStack Router (code-based, register both `/tasks/*` と `/settings/time-slots`) / Tailwind v4 / vitest react preset / `@org/habit-sync` の `state$` + 書き込み helpers / `@legendapp/state/react` の `use$`

**前提条件:**
- M6 完了済（`main` の最新が `7a846cd Merge branch 'feature/habits-m6-today' into main`）
- `@org/habit-sync` から `state$` / `Task` / `TaskInsert` / `TaskUpdate` / `TimeSlot` / `TimeSlotInsert` / `TimeSlotUpdate` / `Frequency` / `taskLogKey` 等が export 済
- 認証済ユーザーの id は `state$.user.get()?.id` で取得可能
- `crypto.randomUUID()` は modern Node / ブラウザで利用可能（vitest node / jsdom 環境でも動く）
- 新規ブランチ `feature/habits-m7-task-crud` を `main` から切って作業
- 設計仕様: §5.1 / §5.2 / §6.2

---

## ファイル構造（作成・変更対象）

```
packages/habit-sync/src/
  task-write.ts                          新規 — createTask / updateTask / archiveTask / unarchiveTask
  task-write.test.ts                     新規
  time-slot-write.ts                     新規 — createTimeSlot / updateTimeSlot / deleteTimeSlot
  time-slot-write.test.ts                新規
  index.ts                               変更 — 新規エクスポート追加

apps/habits/src/
  lib/
    frequency-format.ts                  新規 — formatFrequency(freq) → 表示用日本語文字列
    frequency-format.test.ts             新規
  features/task/
    FrequencyPicker.tsx                  新規 — Frequency 5 type 編集 UI
    FrequencyPicker.test.tsx             新規
    TaskForm.tsx                         新規 — name / time_slot select / FrequencyPicker
    TaskForm.test.tsx                    新規
    TaskCard.tsx                         新規 — 1 行の表示 + 編集/アーカイブボタン
    TaskCard.test.tsx                    新規
    TaskList.tsx                         新規 — 非アーカイブ + アーカイブ済セクション
    TaskList.test.tsx                    新規
  features/timeslot/
    TimeSlotEditor.tsx                   新規 — 1 件のフォーム（新規/編集）
    TimeSlotEditor.test.tsx              新規
    TimeSlotList.tsx                     新規 — 一覧 + 削除ボタン（条件付き）
    TimeSlotList.test.tsx                新規
  routes/tasks/
    TasksPage.tsx                        新規 — /tasks
    TasksPage.test.tsx                   新規
    TaskNewPage.tsx                      新規 — /tasks/new
    TaskNewPage.test.tsx                 新規
    TaskEditPage.tsx                     新規 — /tasks/$id
    TaskEditPage.test.tsx                新規
  routes/settings/
    SettingsTimeSlotsPage.tsx            新規 — /settings/time-slots
    SettingsTimeSlotsPage.test.tsx       新規
  router.tsx                             変更 — 4 ルート追加 + beforeLoad AuthGate
  App.test.tsx                           変更 — 新ルートのリダイレクト挙動を追加
  features/today/
    Today.tsx                            変更 — ヘッダーに /tasks と /settings リンク追加
    Today.test.tsx                       変更 — リンク表示を 1 件追加
```

**依存方向（変更なし）:** `apps/habits → packages/{habit-sync, habit-core}` のままで増えない。

---

## 共通方針

### 楽観更新フロー

```
[ユーザー操作] ──→ createTask({ name, time_slot_id, frequency })
                  ├─ uuid 生成、state$.tasks[id].set({...}) で即時反映
                  └─ syncedSupabase が変更を検知 → Supabase に INSERT
[他デバイス] ──→ Realtime → state$.tasks[...] が更新される
```

### UUID 生成

書き込み helper 内で `crypto.randomUUID()` を呼ぶ。テストでは `vi.spyOn(crypto, 'randomUUID')` または直接結果を生成（`'00000000-0000-0000-0000-000000000001'` 等）で検証する。

### user_id 取得

書き込み helper の引数では `user_id` を受け取らず、内部で `state$.user.get()?.id` を読む。未認証時は throw する（呼び出し側のバグ）。

### TimeSlot 削除の制約（仕様 §2「最低 1 個は残す」）

`deleteTimeSlot(id)` は次の条件をチェックして `{ ok: true } | { ok: false; reason }` を返す:
- スロットが 2 件以上残るか（自身を除いて 1 件以上）
- そのスロットを参照するアクティブタスクが無いか（archived_at = null のタスク 0 件）

両方満たさない場合は state$ に触れずエラー理由を返す。UI は理由を表示する。

### 頻度表示の整形

`formatFrequency(freq: Frequency)` で日本語サマリーを返す。例:

- `{ type: 'daily' }` → 「毎日」
- `{ type: 'every_n_days', n: 3, anchor: '2026-05-01' }` → 「3 日ごと（開始: 2026-05-01）」
- `{ type: 'weekday', days: [1,2,3,4,5] }` → 「月火水木金」
- `{ type: 'day_of_week', days: [4] }` → 「毎週木曜」
- `{ type: 'day_of_week', days: [4], weeks_of_month: [2,4] }` → 「第 2/4 木曜」
- `{ type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-05-01' }` → 「2 週ごと土曜（開始: 2026-05-01）」

### 既存 `today` ルートの AuthGate

`router.tsx` は `/today` で `beforeLoad` の getCurrentSession による AuthGate を持つ。M7 で追加する `/tasks` / `/tasks/new` / `/tasks/$id` / `/settings/time-slots` も同じ AuthGate を共有する。重複を避けるため AuthGate を関数として抽出する。

### コミット

各 Task の最後で単独コミット。pre-commit-gate hook が `pnpm nx affected -t lint test` を自動実行する。

---

## Task 1: `task-write.ts` — タスクの楽観更新 helpers

**目的:** `state$.tasks` への書き込みを集約。`createTask` で uuid 生成 + `state$.user` 参照、`updateTask` で部分更新、`archiveTask` / `unarchiveTask` で archived_at の切替。

**Files:**
- Create: `packages/habit-sync/src/task-write.ts`
- Create: `packages/habit-sync/src/task-write.test.ts`
- Modify: `packages/habit-sync/src/index.ts`

- [ ] **Step 1: テスト作成**

`packages/habit-sync/src/task-write.test.ts`:

```ts
import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { state$ } from './observables.js';
import {
  archiveTask,
  createTask,
  unarchiveTask,
  updateTask,
} from './task-write.js';

const fakeUser = { id: 'u1', email: 'a@b.co' } as unknown as User;

describe('createTask', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.tasks.set({});
  });

  it('uuid を発行して state$.tasks に行を追加する', () => {
    const id = createTask({
      name: '歯磨き',
      time_slot_id: 's1',
      frequency: { type: 'daily' },
      sort_order: 0,
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const row = state$.tasks.get()[id];
    expect(row?.name).toBe('歯磨き');
    expect(row?.time_slot_id).toBe('s1');
    expect(row?.user_id).toBe('u1');
    expect(row?.archived_at).toBeNull();
  });

  it('created_at / updated_at に ISO 文字列が入る', () => {
    const id = createTask({ name: 'A', time_slot_id: 's1', frequency: { type: 'daily' }, sort_order: 0 });
    const row = state$.tasks.get()[id];
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('user 未認証時は throw する', () => {
    state$.user.set(null);
    expect(() =>
      createTask({ name: 'X', time_slot_id: 's1', frequency: { type: 'daily' }, sort_order: 0 }),
    ).toThrow(/未認証/);
  });
});

describe('updateTask', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.tasks.set({
      t1: {
        id: 't1',
        user_id: 'u1',
        time_slot_id: 's1',
        name: '元の名前',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('name のみ更新できる', () => {
    updateTask('t1', { name: '新しい名前' });
    expect(state$.tasks.get().t1?.name).toBe('新しい名前');
    expect(state$.tasks.get().t1?.time_slot_id).toBe('s1');
  });

  it('frequency と time_slot_id も更新できる', () => {
    updateTask('t1', { frequency: { type: 'weekday', days: [1, 2, 3] }, time_slot_id: 's2' });
    const row = state$.tasks.get().t1;
    expect(row?.frequency).toEqual({ type: 'weekday', days: [1, 2, 3] });
    expect(row?.time_slot_id).toBe('s2');
  });

  it('updated_at が更新される', () => {
    updateTask('t1', { name: 'X' });
    expect(state$.tasks.get().t1?.updated_at).not.toBe('2026-01-01T00:00:00Z');
  });

  it('存在しない id は例外を投げない（no-op）', () => {
    expect(() => updateTask('not-exist', { name: 'X' })).not.toThrow();
  });
});

describe('archiveTask / unarchiveTask', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.tasks.set({
      t1: {
        id: 't1',
        user_id: 'u1',
        time_slot_id: 's1',
        name: 'A',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('archiveTask で archived_at に ISO 文字列が入る', () => {
    archiveTask('t1');
    const row = state$.tasks.get().t1;
    expect(row?.archived_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('unarchiveTask で archived_at が null に戻る', () => {
    archiveTask('t1');
    unarchiveTask('t1');
    expect(state$.tasks.get().t1?.archived_at).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/task-write.test.ts
```

- [ ] **Step 3: 実装作成**

`packages/habit-sync/src/task-write.ts`:

```ts
import { state$ } from './observables.js';
import type { Task } from './types.js';
import type { Frequency } from '@org/habit-core';

// 新規タスク作成の入力。id / user_id / created_at / updated_at / archived_at は内部で埋める。
export interface CreateTaskInput {
  name: string;
  time_slot_id: string;
  frequency: Frequency;
  sort_order: number;
}

// state$.tasks に新規タスクを追加。uuid を発行して返す。
// user 未認証時は throw する（呼び出し側のバグ）。
export function createTask(input: CreateTaskInput): string {
  const userId = state$.user.get()?.id;
  if (userId === undefined) {
    throw new Error('createTask: 未認証状態です。state$.user が null。');
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: Task = {
    id,
    user_id: userId,
    time_slot_id: input.time_slot_id,
    name: input.name,
    // Task.frequency は Database 上は Json 型。Frequency 判別共用体は構造的に Json 互換。
    frequency: input.frequency as unknown as Task['frequency'],
    sort_order: input.sort_order,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };
  state$.tasks[id].set(row);
  return id;
}

// state$.tasks[id] の一部を更新。updated_at は自動で現在時刻に。
// 存在しない id は no-op（state$ 側で行が無くなる可能性に保守的に対応）。
export type UpdateTaskInput = Partial<{
  name: string;
  time_slot_id: string;
  frequency: Frequency;
  sort_order: number;
}>;

export function updateTask(id: string, patch: UpdateTaskInput): void {
  const current = state$.tasks.get()[id];
  if (current === undefined) {
    return;
  }
  const next: Task = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.time_slot_id !== undefined ? { time_slot_id: patch.time_slot_id } : {}),
    ...(patch.frequency !== undefined
      ? { frequency: patch.frequency as unknown as Task['frequency'] }
      : {}),
    ...(patch.sort_order !== undefined ? { sort_order: patch.sort_order } : {}),
    updated_at: new Date().toISOString(),
  };
  state$.tasks[id].set(next);
}

// アーカイブ: archived_at を ISO 文字列に。
export function archiveTask(id: string): void {
  const current = state$.tasks.get()[id];
  if (current === undefined) {
    return;
  }
  const now = new Date().toISOString();
  state$.tasks[id].set({ ...current, archived_at: now, updated_at: now });
}

// 復元: archived_at を null に。
export function unarchiveTask(id: string): void {
  const current = state$.tasks.get()[id];
  if (current === undefined) {
    return;
  }
  state$.tasks[id].set({ ...current, archived_at: null, updated_at: new Date().toISOString() });
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/task-write.test.ts
```

Expected: 10 件 pass（createTask 3 + updateTask 4 + archive/unarchive 2 + 1 件は他）。実数: createTask 3、updateTask 4、archiveTask/unarchiveTask 2 = **9 件**。

- [ ] **Step 5: `index.ts` に re-export 追加**

`packages/habit-sync/src/index.ts` に追加（Biome が並び替える）:

```ts
export type { CreateTaskInput, UpdateTaskInput } from './task-write.js';
export { archiveTask, createTask, unarchiveTask, updateTask } from './task-write.js';
```

- [ ] **Step 6: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-sync/src/task-write.ts packages/habit-sync/src/task-write.test.ts packages/habit-sync/src/index.ts
git commit -m "$(cat <<'EOF'
feat(habit-sync): タスクの楽観更新 helpers (create/update/archive)

createTask: uuid 発行 + state$.user.id 取得 + state$.tasks への書き込み。
updateTask: 部分更新 + updated_at 自動更新。
archiveTask / unarchiveTask: archived_at の ISO 文字列 / null 切替。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `time-slot-write.ts` — 時間帯の楽観更新 helpers

**目的:** `state$.time_slots` への書き込み。`createTimeSlot` / `updateTimeSlot` / `deleteTimeSlot`。delete は「最低 1 個は残す」+ 「参照タスクなし」のガード付き。

**Files:**
- Create: `packages/habit-sync/src/time-slot-write.ts`
- Create: `packages/habit-sync/src/time-slot-write.test.ts`
- Modify: `packages/habit-sync/src/index.ts`

- [ ] **Step 1: テスト作成**

`packages/habit-sync/src/time-slot-write.test.ts`:

```ts
import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { state$ } from './observables.js';
import {
  createTimeSlot,
  deleteTimeSlot,
  updateTimeSlot,
} from './time-slot-write.js';

const fakeUser = { id: 'u1', email: 'a@b.co' } as unknown as User;

describe('createTimeSlot', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.time_slots.set({});
  });

  it('uuid を発行して state$.time_slots に行を追加する', () => {
    const id = createTimeSlot({ name: '朝', notify_at: '07:00:00', sort_order: 0 });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const row = state$.time_slots.get()[id];
    expect(row?.name).toBe('朝');
    expect(row?.notify_at).toBe('07:00:00');
    expect(row?.user_id).toBe('u1');
  });

  it('user 未認証時は throw する', () => {
    state$.user.set(null);
    expect(() => createTimeSlot({ name: 'X', notify_at: '08:00:00', sort_order: 0 })).toThrow(/未認証/);
  });
});

describe('updateTimeSlot', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.time_slots.set({
      s1: {
        id: 's1',
        user_id: 'u1',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('name と notify_at を更新できる', () => {
    updateTimeSlot('s1', { name: '早朝', notify_at: '05:30:00' });
    const row = state$.time_slots.get().s1;
    expect(row?.name).toBe('早朝');
    expect(row?.notify_at).toBe('05:30:00');
  });

  it('存在しない id は no-op', () => {
    expect(() => updateTimeSlot('not-exist', { name: 'X' })).not.toThrow();
  });
});

describe('deleteTimeSlot', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.time_slots.set({
      s1: {
        id: 's1',
        user_id: 'u1',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      s2: {
        id: 's2',
        user_id: 'u1',
        name: '夜',
        notify_at: '21:00:00',
        sort_order: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    state$.tasks.set({});
  });

  it('参照タスクが無く 2 件以上残る場合は削除成功', () => {
    const result = deleteTimeSlot('s1');
    expect(result).toEqual({ ok: true });
    expect(state$.time_slots.get().s1).toBeUndefined();
    expect(state$.time_slots.get().s2).toBeDefined();
  });

  it('最後の 1 件は削除不可', () => {
    deleteTimeSlot('s1');
    const result = deleteTimeSlot('s2');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/最低 1 個/);
    }
    expect(state$.time_slots.get().s2).toBeDefined();
  });

  it('アクティブタスクが参照している場合は削除不可', () => {
    state$.tasks.set({
      t1: {
        id: 't1',
        user_id: 'u1',
        time_slot_id: 's1',
        name: '歯磨き',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    const result = deleteTimeSlot('s1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/タスク/);
    }
    expect(state$.time_slots.get().s1).toBeDefined();
  });

  it('アーカイブ済タスクのみ参照している場合も削除不可', () => {
    state$.tasks.set({
      t1: {
        id: 't1',
        user_id: 'u1',
        time_slot_id: 's1',
        name: '歯磨き',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: '2026-05-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    const result = deleteTimeSlot('s1');
    // アーカイブ済も FK 制約があるので削除不可とする
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/time-slot-write.test.ts
```

- [ ] **Step 3: 実装作成**

`packages/habit-sync/src/time-slot-write.ts`:

```ts
import { state$ } from './observables.js';
import type { TimeSlot } from './types.js';

export interface CreateTimeSlotInput {
  name: string;
  notify_at: string; // 'HH:MM:SS'
  sort_order: number;
}

export type UpdateTimeSlotInput = Partial<{
  name: string;
  notify_at: string;
  sort_order: number;
}>;

export type DeleteResult = { ok: true } | { ok: false; reason: string };

export function createTimeSlot(input: CreateTimeSlotInput): string {
  const userId = state$.user.get()?.id;
  if (userId === undefined) {
    throw new Error('createTimeSlot: 未認証状態です。state$.user が null。');
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: TimeSlot = {
    id,
    user_id: userId,
    name: input.name,
    notify_at: input.notify_at,
    sort_order: input.sort_order,
    created_at: now,
    updated_at: now,
  };
  state$.time_slots[id].set(row);
  return id;
}

export function updateTimeSlot(id: string, patch: UpdateTimeSlotInput): void {
  const current = state$.time_slots.get()[id];
  if (current === undefined) {
    return;
  }
  const next: TimeSlot = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.notify_at !== undefined ? { notify_at: patch.notify_at } : {}),
    ...(patch.sort_order !== undefined ? { sort_order: patch.sort_order } : {}),
    updated_at: new Date().toISOString(),
  };
  state$.time_slots[id].set(next);
}

// 削除可能条件:
//   1. 削除後に時間帯が 1 件以上残る
//   2. このスロットを参照するタスクが 1 件も無い（archived 含む）
export function deleteTimeSlot(id: string): DeleteResult {
  const slots = state$.time_slots.get();
  if (slots[id] === undefined) {
    return { ok: true }; // 既に無いなら no-op 成功
  }
  const remainingCount = Object.keys(slots).filter((k) => k !== id).length;
  if (remainingCount < 1) {
    return { ok: false, reason: '時間帯は最低 1 個必要です。' };
  }
  const referencingTasks = Object.values(state$.tasks.get()).filter(
    (t) => t.time_slot_id === id,
  );
  if (referencingTasks.length > 0) {
    return {
      ok: false,
      reason: `この時間帯を参照するタスクが ${referencingTasks.length} 件あります。先に別の時間帯に移動するか削除してください。`,
    };
  }
  state$.time_slots[id].delete();
  return { ok: true };
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/time-slot-write.test.ts
```

Expected: 8 件 pass。

- [ ] **Step 5: `index.ts` に re-export 追加**

```ts
export type {
  CreateTimeSlotInput,
  DeleteResult,
  UpdateTimeSlotInput,
} from './time-slot-write.js';
export { createTimeSlot, deleteTimeSlot, updateTimeSlot } from './time-slot-write.js';
```

- [ ] **Step 6: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-sync/src/time-slot-write.ts packages/habit-sync/src/time-slot-write.test.ts packages/habit-sync/src/index.ts
git commit -m "$(cat <<'EOF'
feat(habit-sync): 時間帯の楽観更新 helpers (create/update/delete)

createTimeSlot / updateTimeSlot は task-write と同じ pattern。
deleteTimeSlot は「最低 1 個残す」+「参照タスクなし」を満たさない場合
{ ok: false, reason } を返す（state$ には触れない）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `frequency-format.ts` — 頻度ルールの日本語サマリ

**目的:** `Frequency` を日本語の短い表示文字列に整形する純粋関数。TaskCard と TaskList の表示で使う。

**Files:**
- Create: `apps/habits/src/lib/frequency-format.ts`
- Create: `apps/habits/src/lib/frequency-format.test.ts`

- [ ] **Step 1: テスト作成**

`apps/habits/src/lib/frequency-format.test.ts`:

```ts
import type { Frequency } from '@org/habit-core';
import { describe, expect, it } from 'vitest';
import { formatFrequency } from './frequency-format.js';

describe('formatFrequency', () => {
  it('daily → 「毎日」', () => {
    expect(formatFrequency({ type: 'daily' })).toBe('毎日');
  });

  it('every_n_days n=3 → 「3 日ごと（開始: 2026-05-01）」', () => {
    expect(formatFrequency({ type: 'every_n_days', n: 3, anchor: '2026-05-01' })).toBe(
      '3 日ごと（開始: 2026-05-01）',
    );
  });

  it('every_n_days n=1 → 「1 日ごと（開始: ...）」', () => {
    expect(formatFrequency({ type: 'every_n_days', n: 1, anchor: '2026-05-16' })).toBe(
      '1 日ごと（開始: 2026-05-16）',
    );
  });

  it('weekday days=[1,2,3,4,5] → 「月火水木金」', () => {
    expect(formatFrequency({ type: 'weekday', days: [1, 2, 3, 4, 5] })).toBe('月火水木金');
  });

  it('weekday days=[6,7] → 「土日」', () => {
    expect(formatFrequency({ type: 'weekday', days: [6, 7] })).toBe('土日');
  });

  it('weekday days=[] → 「なし」', () => {
    expect(formatFrequency({ type: 'weekday', days: [] })).toBe('なし');
  });

  it('day_of_week days=[4] no weeks_of_month → 「毎週木曜」', () => {
    expect(formatFrequency({ type: 'day_of_week', days: [4] })).toBe('毎週木曜');
  });

  it('day_of_week days=[4] weeks_of_month=[2,4] → 「第 2/4 木曜」', () => {
    const f: Frequency = { type: 'day_of_week', days: [4], weeks_of_month: [2, 4] };
    expect(formatFrequency(f)).toBe('第 2/4 木曜');
  });

  it('day_of_week 複数曜日 weeks_of_month あり → 「第 2/4 月水金」', () => {
    const f: Frequency = { type: 'day_of_week', days: [1, 3, 5], weeks_of_month: [2, 4] };
    expect(formatFrequency(f)).toBe('第 2/4 月水金');
  });

  it('every_n_weeks n=2 day_of_week=6 → 「2 週ごと土曜（開始: 2026-05-01）」', () => {
    const f: Frequency = { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-05-01' };
    expect(formatFrequency(f)).toBe('2 週ごと土曜（開始: 2026-05-01）');
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/lib/frequency-format.test.ts
```

- [ ] **Step 3: 実装作成**

`apps/habits/src/lib/frequency-format.ts`:

```ts
import type { Frequency } from '@org/habit-core';

const DAY_LABEL_BY_ISO: Record<number, string> = {
  1: '月',
  2: '火',
  3: '水',
  4: '木',
  5: '金',
  6: '土',
  7: '日',
};

function formatDays(days: ReadonlyArray<number>): string {
  if (days.length === 0) {
    return 'なし';
  }
  // 月..日 の順に整列して連結
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABEL_BY_ISO[d] ?? '?')
    .join('');
}

// Frequency を日本語の短いサマリ文字列に整形する。
// 例: 'daily' → '毎日'、'every_n_days' → '3 日ごと（開始: 2026-05-01）'
export function formatFrequency(freq: Frequency): string {
  if (freq.type === 'daily') {
    return '毎日';
  }
  if (freq.type === 'every_n_days') {
    return `${freq.n} 日ごと（開始: ${freq.anchor}）`;
  }
  if (freq.type === 'weekday') {
    return formatDays(freq.days);
  }
  if (freq.type === 'day_of_week') {
    const dayLabel = formatDays(freq.days);
    if (freq.weeks_of_month === undefined) {
      // 1 曜日なら「毎週木曜」、複数なら「毎週月水金」
      return `毎週${dayLabel}曜`;
    }
    // 第 n/m 曜
    const weeks = [...freq.weeks_of_month].sort((a, b) => a - b).join('/');
    return `第 ${weeks} ${dayLabel}曜`;
  }
  if (freq.type === 'every_n_weeks') {
    const dow = DAY_LABEL_BY_ISO[freq.day_of_week] ?? '?';
    return `${freq.n} 週ごと${dow}曜（開始: ${freq.anchor}）`;
  }
  return '?';
}
```

> **注:** `'day_of_week'` の単曜日のとき「毎週木曜」、複数曜日のとき「毎週月水金」となるよう曜の前にラベルを直接連結する形式にした（テストでは複数曜日のケースは weeks_of_month 付きしか含まれていないが、formatDays の挙動で自然に拡張できる）。

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/lib/frequency-format.test.ts
```

Expected: 10 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/lib/frequency-format.ts apps/habits/src/lib/frequency-format.test.ts
git commit -m "$(cat <<'EOF'
feat(habits): formatFrequency で頻度ルールを日本語サマリに整形

5 type すべての Frequency を短い表示文字列に変換する純粋関数。
TaskCard / TaskList での頻度表示に使う。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `FrequencyPicker` コンポーネント

**目的:** 5 type の Frequency を編集する UI。type を select で選び、type に応じてサブフォームを表示。`value` / `onChange(next)` の controlled component。

**Files:**
- Create: `apps/habits/src/features/task/FrequencyPicker.tsx`
- Create: `apps/habits/src/features/task/FrequencyPicker.test.tsx`

- [ ] **Step 1: テスト作成**

`apps/habits/src/features/task/FrequencyPicker.test.tsx`:

```tsx
import type { Frequency } from '@org/habit-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FrequencyPicker } from './FrequencyPicker.js';

describe('FrequencyPicker', () => {
  it('type select で type を切り替えると onChange が呼ばれる', () => {
    const onChange = vi.fn();
    render(<FrequencyPicker value={{ type: 'daily' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('頻度の種類'), { target: { value: 'every_n_days' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'every_n_days', n: 1, anchor: expect.any(String) }),
    );
  });

  it('type=daily ではサブフォームを表示しない', () => {
    render(<FrequencyPicker value={{ type: 'daily' }} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('n（日数）')).not.toBeInTheDocument();
  });

  it('type=every_n_days で n と anchor を表示する', () => {
    const value: Frequency = { type: 'every_n_days', n: 3, anchor: '2026-05-01' };
    render(<FrequencyPicker value={value} onChange={vi.fn()} />);
    expect(screen.getByLabelText('n（日数）')).toHaveValue(3);
    expect(screen.getByLabelText('開始日')).toHaveValue('2026-05-01');
  });

  it('every_n_days の n を変えると onChange が呼ばれる', () => {
    const onChange = vi.fn();
    const value: Frequency = { type: 'every_n_days', n: 3, anchor: '2026-05-01' };
    render(<FrequencyPicker value={value} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('n（日数）'), { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'every_n_days', n: 7, anchor: '2026-05-01' });
  });

  it('type=weekday で 7 個の曜日チェックボックスが出る', () => {
    render(<FrequencyPicker value={{ type: 'weekday', days: [1, 2] }} onChange={vi.fn()} />);
    expect(screen.getByLabelText('月')).toBeChecked();
    expect(screen.getByLabelText('火')).toBeChecked();
    expect(screen.getByLabelText('水')).not.toBeChecked();
    expect(screen.getByLabelText('日')).not.toBeChecked();
  });

  it('weekday で曜日を toggle すると onChange が呼ばれる', () => {
    const onChange = vi.fn();
    render(<FrequencyPicker value={{ type: 'weekday', days: [1] }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('火'));
    expect(onChange).toHaveBeenCalledWith({ type: 'weekday', days: [1, 2] });
  });

  it('type=day_of_week で weeks_of_month チェックボックス（1〜5）が出る', () => {
    render(
      <FrequencyPicker
        value={{ type: 'day_of_week', days: [4], weeks_of_month: [2, 4] }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('第 2 週')).toBeChecked();
    expect(screen.getByLabelText('第 4 週')).toBeChecked();
    expect(screen.getByLabelText('第 1 週')).not.toBeChecked();
  });

  it('type=every_n_weeks で n と day_of_week select と anchor が出る', () => {
    const value: Frequency = {
      type: 'every_n_weeks',
      n: 2,
      day_of_week: 6,
      anchor: '2026-05-01',
    };
    render(<FrequencyPicker value={value} onChange={vi.fn()} />);
    expect(screen.getByLabelText('n（週数）')).toHaveValue(2);
    expect(screen.getByLabelText('曜日')).toHaveValue('6');
    expect(screen.getByLabelText('開始日')).toHaveValue('2026-05-01');
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/task/FrequencyPicker.test.tsx
```

- [ ] **Step 3: 実装作成**

`apps/habits/src/features/task/FrequencyPicker.tsx`:

```tsx
import type { Frequency } from '@org/habit-core';

export interface FrequencyPickerProps {
  value: Frequency;
  onChange: (next: Frequency) => void;
}

const TYPE_OPTIONS: ReadonlyArray<{ value: Frequency['type']; label: string }> = [
  { value: 'daily', label: '毎日' },
  { value: 'every_n_days', label: 'N 日ごと' },
  { value: 'weekday', label: '曜日指定' },
  { value: 'day_of_week', label: '曜日 + 第 n 週' },
  { value: 'every_n_weeks', label: 'N 週ごと' },
];

const WEEKDAY_LABELS: ReadonlyArray<{ iso: number; label: string }> = [
  { iso: 1, label: '月' },
  { iso: 2, label: '火' },
  { iso: 3, label: '水' },
  { iso: 4, label: '木' },
  { iso: 5, label: '金' },
  { iso: 6, label: '土' },
  { iso: 7, label: '日' },
];

const WEEKS_OF_MONTH = [1, 2, 3, 4, 5] as const;

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 型変更時のデフォルト値を返す
function defaultForType(type: Frequency['type']): Frequency {
  switch (type) {
    case 'daily':
      return { type: 'daily' };
    case 'every_n_days':
      return { type: 'every_n_days', n: 1, anchor: todayString() };
    case 'weekday':
      return { type: 'weekday', days: [1, 2, 3, 4, 5] };
    case 'day_of_week':
      return { type: 'day_of_week', days: [1] };
    case 'every_n_weeks':
      return { type: 'every_n_weeks', n: 1, day_of_week: 1, anchor: todayString() };
  }
}

function toggleDay(days: ReadonlyArray<number>, iso: number): number[] {
  return days.includes(iso) ? days.filter((d) => d !== iso) : [...days, iso].sort((a, b) => a - b);
}

export function FrequencyPicker({ value, onChange }: FrequencyPickerProps): React.ReactElement {
  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">頻度の種類</span>
        <select
          value={value.type}
          onChange={(e) => {
            onChange(defaultForType(e.target.value as Frequency['type']));
          }}
          className="block w-full rounded border border-gray-500 bg-transparent px-2 py-1"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {value.type === 'every_n_days' && (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-sm">n（日数）</span>
            <input
              type="number"
              min="1"
              value={value.n}
              onChange={(e) => {
                const n = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                onChange({ ...value, n });
              }}
              className="block w-32 rounded border border-gray-500 bg-transparent px-2 py-1"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">開始日</span>
            <input
              type="date"
              value={value.anchor}
              onChange={(e) => {
                onChange({ ...value, anchor: e.target.value });
              }}
              className="block rounded border border-gray-500 bg-transparent px-2 py-1"
            />
          </label>
        </div>
      )}

      {(value.type === 'weekday' || value.type === 'day_of_week') && (
        <fieldset className="space-y-2">
          <legend className="text-sm">曜日</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map(({ iso, label }) => (
              <label key={iso} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={value.days.includes(iso)}
                  onChange={() => {
                    onChange({ ...value, days: toggleDay(value.days, iso) });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {value.type === 'day_of_week' && (
        <fieldset className="space-y-2">
          <legend className="text-sm">第 n 週（未指定なら毎週）</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKS_OF_MONTH.map((w) => {
              const checked = value.weeks_of_month?.includes(w) ?? false;
              return (
                <label key={w} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    aria-label={`第 ${w} 週`}
                    checked={checked}
                    onChange={() => {
                      const current = value.weeks_of_month ?? [];
                      const next = current.includes(w)
                        ? current.filter((x) => x !== w)
                        : [...current, w].sort((a, b) => a - b);
                      onChange({ ...value, weeks_of_month: next.length === 0 ? undefined : next });
                    }}
                  />
                  第 {w} 週
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {value.type === 'every_n_weeks' && (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-sm">n（週数）</span>
            <input
              type="number"
              min="1"
              value={value.n}
              onChange={(e) => {
                const n = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                onChange({ ...value, n });
              }}
              className="block w-32 rounded border border-gray-500 bg-transparent px-2 py-1"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">曜日</span>
            <select
              value={String(value.day_of_week)}
              onChange={(e) => {
                onChange({ ...value, day_of_week: Number.parseInt(e.target.value, 10) });
              }}
              className="block w-32 rounded border border-gray-500 bg-transparent px-2 py-1"
            >
              {WEEKDAY_LABELS.map(({ iso, label }) => (
                <option key={iso} value={iso}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm">開始日</span>
            <input
              type="date"
              value={value.anchor}
              onChange={(e) => {
                onChange({ ...value, anchor: e.target.value });
              }}
              className="block rounded border border-gray-500 bg-transparent px-2 py-1"
            />
          </label>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/task/FrequencyPicker.test.tsx
```

Expected: 8 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/task/FrequencyPicker.tsx apps/habits/src/features/task/FrequencyPicker.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): FrequencyPicker で頻度ルール 5 type を編集可能に

type select + type に応じたサブフォーム（n / 曜日 / weeks_of_month / anchor）。
controlled component で value / onChange を受け取る。
type 切替時はデフォルト値を自動セット。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `TaskForm` コンポーネント

**目的:** タスクの新規作成 / 編集フォーム。`mode = 'create' | 'edit'` で onSubmit ハンドラの中身を切り替える。`initial` を渡せばその値で初期化、`time_slots` を渡せば select に表示。FrequencyPicker を内包。

**Files:**
- Create: `apps/habits/src/features/task/TaskForm.tsx`
- Create: `apps/habits/src/features/task/TaskForm.test.tsx`

- [ ] **Step 1: テスト作成**

`apps/habits/src/features/task/TaskForm.test.tsx`:

```tsx
import type { Frequency } from '@org/habit-core';
import type { TimeSlot } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskForm } from './TaskForm.js';

const slots: TimeSlot[] = [
  {
    id: 's1',
    user_id: 'u1',
    name: '朝',
    notify_at: '07:00:00',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 's2',
    user_id: 'u1',
    name: '夜',
    notify_at: '21:00:00',
    sort_order: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

describe('TaskForm', () => {
  it('name の入力欄を表示する', () => {
    render(<TaskForm timeSlots={slots} onSubmit={vi.fn()} submitLabel="保存" />);
    expect(screen.getByLabelText('タスク名')).toBeInTheDocument();
  });

  it('time_slot の select に渡された slots が並ぶ', () => {
    render(<TaskForm timeSlots={slots} onSubmit={vi.fn()} submitLabel="保存" />);
    expect(screen.getByRole('option', { name: '朝' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '夜' })).toBeInTheDocument();
  });

  it('initial を渡すとフィールドが初期化される', () => {
    const initial = {
      name: '歯磨き',
      time_slot_id: 's2',
      frequency: { type: 'daily' } satisfies Frequency,
    };
    render(<TaskForm timeSlots={slots} initial={initial} onSubmit={vi.fn()} submitLabel="保存" />);
    expect(screen.getByLabelText('タスク名')).toHaveValue('歯磨き');
    expect(screen.getByLabelText('時間帯')).toHaveValue('s2');
  });

  it('submit で onSubmit が現在値を受け取る', () => {
    const onSubmit = vi.fn();
    render(<TaskForm timeSlots={slots} onSubmit={onSubmit} submitLabel="作成" />);
    fireEvent.change(screen.getByLabelText('タスク名'), { target: { value: '新タスク' } });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '新タスク',
        time_slot_id: 's1', // 最初の slot がデフォルト
        frequency: { type: 'daily' },
      }),
    );
  });

  it('name が空のときは onSubmit を呼ばずエラーを表示する', () => {
    const onSubmit = vi.fn();
    render(<TaskForm timeSlots={slots} onSubmit={onSubmit} submitLabel="作成" />);
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/タスク名/);
  });

  it('time_slots が空のとき警告を表示し submit を無効化する', () => {
    render(<TaskForm timeSlots={[]} onSubmit={vi.fn()} submitLabel="作成" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/時間帯/);
    expect(screen.getByRole('button', { name: '作成' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/task/TaskForm.test.tsx
```

- [ ] **Step 3: 実装作成**

`apps/habits/src/features/task/TaskForm.tsx`:

```tsx
import type { Frequency } from '@org/habit-core';
import type { TimeSlot } from '@org/habit-sync';
import { type FormEvent, useState } from 'react';
import { FrequencyPicker } from './FrequencyPicker.js';

export interface TaskFormValues {
  name: string;
  time_slot_id: string;
  frequency: Frequency;
}

export interface TaskFormProps {
  timeSlots: TimeSlot[];
  initial?: Partial<TaskFormValues>;
  onSubmit: (values: TaskFormValues) => void;
  submitLabel: string;
}

export function TaskForm({
  timeSlots,
  initial,
  onSubmit,
  submitLabel,
}: TaskFormProps): React.ReactElement {
  const [name, setName] = useState(initial?.name ?? '');
  const [timeSlotId, setTimeSlotId] = useState(initial?.time_slot_id ?? timeSlots[0]?.id ?? '');
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? { type: 'daily' });
  const [validationError, setValidationError] = useState<string | null>(null);

  const noSlots = timeSlots.length === 0;

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (name.trim() === '') {
      setValidationError('タスク名を入力してください。');
      return;
    }
    if (timeSlotId === '') {
      setValidationError('時間帯を選択してください。');
      return;
    }
    setValidationError(null);
    onSubmit({ name: name.trim(), time_slot_id: timeSlotId, frequency });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">タスク名</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full rounded border border-gray-500 bg-transparent px-3 py-2"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">時間帯</span>
        <select
          value={timeSlotId}
          onChange={(e) => setTimeSlotId(e.target.value)}
          disabled={noSlots}
          className="block w-full rounded border border-gray-500 bg-transparent px-3 py-2"
        >
          {timeSlots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">頻度</legend>
        <FrequencyPicker value={frequency} onChange={setFrequency} />
      </fieldset>

      {noSlots && (
        <p role="alert" className="text-sm text-red-400">
          時間帯が登録されていません。先に「設定 → 時間帯」で 1 件以上作成してください。
        </p>
      )}
      {validationError !== null && (
        <p role="alert" className="text-sm text-red-400">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        disabled={noSlots}
        className="rounded bg-game-accent px-4 py-2 font-medium text-game-bg disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/task/TaskForm.test.tsx
```

Expected: 6 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/task/TaskForm.tsx apps/habits/src/features/task/TaskForm.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): TaskForm (新規/編集共通) + FrequencyPicker 統合

name / time_slot select / FrequencyPicker を含む controlled form。
initial で初期化、空 name / 空 timeSlots でエラー表示。
mode 切替は submitLabel と initial で表現（呼び出し側責任）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `TaskCard` + `TaskList` コンポーネント

**目的:** TaskCard が 1 タスクを 1 行で表示（名前 + 時間帯名 + 頻度サマリ + 編集ボタン + アーカイブ/復元ボタン）。TaskList が `state$.tasks` / `state$.time_slots` を購読してカードを並べる。アーカイブ済みは別セクションに分けて表示。

**Files:**
- Create: `apps/habits/src/features/task/TaskCard.tsx`
- Create: `apps/habits/src/features/task/TaskCard.test.tsx`
- Create: `apps/habits/src/features/task/TaskList.tsx`
- Create: `apps/habits/src/features/task/TaskList.test.tsx`

- [ ] **Step 1: `TaskCard.tsx` のテスト作成**

`apps/habits/src/features/task/TaskCard.test.tsx`:

```tsx
import type { Task, TimeSlot } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskCard } from './TaskCard.js';

const baseTask: Task = {
  id: 't1',
  user_id: 'u1',
  time_slot_id: 's1',
  name: '歯磨き',
  frequency: { type: 'daily' },
  sort_order: 0,
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const slot: TimeSlot = {
  id: 's1',
  user_id: 'u1',
  name: '朝',
  notify_at: '07:00:00',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('TaskCard', () => {
  it('タスク名と頻度サマリと時間帯名を表示する', () => {
    render(
      <TaskCard
        task={baseTask}
        timeSlotName={slot.name}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />,
    );
    expect(screen.getByText('歯磨き')).toBeInTheDocument();
    expect(screen.getByText('毎日')).toBeInTheDocument();
    expect(screen.getByText('朝')).toBeInTheDocument();
  });

  it('archived=null では「編集」と「アーカイブ」ボタンを表示する', () => {
    render(
      <TaskCard
        task={baseTask}
        timeSlotName={slot.name}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'アーカイブ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '復元' })).not.toBeInTheDocument();
  });

  it('archived の場合は「復元」のみ表示', () => {
    const archived = { ...baseTask, archived_at: '2026-05-01T00:00:00Z' };
    render(
      <TaskCard
        task={archived}
        timeSlotName={slot.name}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '復元' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'アーカイブ' })).not.toBeInTheDocument();
  });

  it('「編集」クリックで onEdit が呼ばれる', () => {
    const onEdit = vi.fn();
    render(
      <TaskCard
        task={baseTask}
        timeSlotName={slot.name}
        onEdit={onEdit}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    expect(onEdit).toHaveBeenCalledWith('t1');
  });

  it('「アーカイブ」クリックで onArchive が呼ばれる', () => {
    const onArchive = vi.fn();
    render(
      <TaskCard
        task={baseTask}
        timeSlotName={slot.name}
        onEdit={vi.fn()}
        onArchive={onArchive}
        onUnarchive={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'アーカイブ' }));
    expect(onArchive).toHaveBeenCalledWith('t1');
  });

  it('「復元」クリックで onUnarchive が呼ばれる', () => {
    const onUnarchive = vi.fn();
    const archived = { ...baseTask, archived_at: '2026-05-01T00:00:00Z' };
    render(
      <TaskCard
        task={archived}
        timeSlotName={slot.name}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onUnarchive={onUnarchive}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '復元' }));
    expect(onUnarchive).toHaveBeenCalledWith('t1');
  });
});
```

- [ ] **Step 2: `TaskCard.tsx` 実装作成**

`apps/habits/src/features/task/TaskCard.tsx`:

```tsx
import type { Frequency } from '@org/habit-core';
import type { Task } from '@org/habit-sync';
import { formatFrequency } from '../../lib/frequency-format.js';

export interface TaskCardProps {
  task: Task;
  timeSlotName: string;
  onEdit: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  onUnarchive: (taskId: string) => void;
}

export function TaskCard({
  task,
  timeSlotName,
  onEdit,
  onArchive,
  onUnarchive,
}: TaskCardProps): React.ReactElement {
  const isArchived = task.archived_at !== null;
  const freq = task.frequency as unknown as Frequency;
  return (
    <li
      className={`flex items-center gap-3 rounded border border-gray-700 p-3 ${
        isArchived ? 'opacity-60' : ''
      }`}
    >
      <div className="flex-1 space-y-1">
        <div className="text-sm font-medium">{task.name}</div>
        <div className="text-xs text-gray-400">
          {timeSlotName} ／ {formatFrequency(freq)}
        </div>
      </div>
      {isArchived ? (
        <button
          type="button"
          onClick={() => onUnarchive(task.id)}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          復元
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onEdit(task.id)}
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            編集
          </button>
          <button
            type="button"
            onClick={() => onArchive(task.id)}
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            アーカイブ
          </button>
        </>
      )}
    </li>
  );
}
```

- [ ] **Step 3: `TaskCard` テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/task/TaskCard.test.tsx
```

Expected: 6 件 pass。

- [ ] **Step 4: `TaskList.tsx` のテスト作成**

`apps/habits/src/features/task/TaskList.test.tsx`:

```tsx
import { state$, type Task, type TimeSlot } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskList } from './TaskList.js';

function task(t: Partial<Task> & Pick<Task, 'id' | 'name' | 'time_slot_id'>): Task {
  return {
    user_id: 'u1',
    frequency: { type: 'daily' },
    sort_order: 0,
    archived_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...t,
  };
}

function slot(s: Partial<TimeSlot> & Pick<TimeSlot, 'id' | 'name'>): TimeSlot {
  return {
    user_id: 'u1',
    notify_at: '07:00:00',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...s,
  };
}

describe('TaskList', () => {
  beforeEach(() => {
    state$.tasks.set({});
    state$.time_slots.set({});
  });

  it('タスクが 0 件のときは Empty を表示', () => {
    render(<TaskList onEdit={vi.fn()} />);
    expect(screen.getByText(/タスクが登録されていません/)).toBeInTheDocument();
  });

  it('アクティブなタスクを表示する', () => {
    state$.time_slots.set({ s1: slot({ id: 's1', name: '朝' }) });
    state$.tasks.set({
      t1: task({ id: 't1', name: '歯磨き', time_slot_id: 's1' }),
    });
    render(<TaskList onEdit={vi.fn()} />);
    expect(screen.getByText('歯磨き')).toBeInTheDocument();
  });

  it('アーカイブ済タスクは初期表示では非表示', () => {
    state$.time_slots.set({ s1: slot({ id: 's1', name: '朝' }) });
    state$.tasks.set({
      t1: task({
        id: 't1',
        name: 'アーカイブ済',
        time_slot_id: 's1',
        archived_at: '2026-01-01T00:00:00Z',
      }),
    });
    render(<TaskList onEdit={vi.fn()} />);
    expect(screen.queryByText('アーカイブ済')).not.toBeInTheDocument();
  });

  it('「アーカイブ済を表示」をクリックすると非アクティブセクションが見える', () => {
    state$.time_slots.set({ s1: slot({ id: 's1', name: '朝' }) });
    state$.tasks.set({
      t1: task({
        id: 't1',
        name: 'アーカイブ済',
        time_slot_id: 's1',
        archived_at: '2026-01-01T00:00:00Z',
      }),
    });
    render(<TaskList onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /アーカイブ済を表示/ }));
    expect(screen.getByText('アーカイブ済')).toBeInTheDocument();
  });

  it('onEdit がカードの「編集」クリックで呼ばれる', () => {
    state$.time_slots.set({ s1: slot({ id: 's1', name: '朝' }) });
    state$.tasks.set({
      t1: task({ id: 't1', name: '歯磨き', time_slot_id: 's1' }),
    });
    const onEdit = vi.fn();
    render(<TaskList onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    expect(onEdit).toHaveBeenCalledWith('t1');
  });
});
```

- [ ] **Step 5: `TaskList.tsx` 実装作成**

`apps/habits/src/features/task/TaskList.tsx`:

```tsx
import { use$ } from '@legendapp/state/react';
import { archiveTask, state$, unarchiveTask } from '@org/habit-sync';
import { useState } from 'react';
import { TaskCard } from './TaskCard.js';

export interface TaskListProps {
  onEdit: (taskId: string) => void;
}

export function TaskList({ onEdit }: TaskListProps): React.ReactElement {
  const [showArchived, setShowArchived] = useState(false);

  const { active, archived, slotNameById } = use$(() => {
    const tasks = Object.values(state$.tasks.get());
    const slots = state$.time_slots.get();
    const slotName: Record<string, string> = {};
    for (const s of Object.values(slots)) {
      slotName[s.id] = s.name;
    }
    const sorted = [...tasks].sort((a, b) => a.sort_order - b.sort_order);
    return {
      active: sorted.filter((t) => t.archived_at === null),
      archived: sorted.filter((t) => t.archived_at !== null),
      slotNameById: slotName,
    };
  });

  if (active.length === 0 && archived.length === 0) {
    return (
      <p className="text-sm text-gray-400">タスクが登録されていません。新規追加してください。</p>
    );
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              timeSlotName={slotNameById[t.time_slot_id] ?? '不明'}
              onEdit={onEdit}
              onArchive={archiveTask}
              onUnarchive={unarchiveTask}
            />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-sm text-gray-400 underline"
          >
            {showArchived ? `アーカイブ済を隠す (${archived.length})` : `アーカイブ済を表示 (${archived.length})`}
          </button>
          {showArchived && (
            <ul className="space-y-2">
              {archived.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  timeSlotName={slotNameById[t.time_slot_id] ?? '不明'}
                  onEdit={onEdit}
                  onArchive={archiveTask}
                  onUnarchive={unarchiveTask}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 6: テスト通過確認 + コミット**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/task/TaskList.test.tsx
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/task/TaskCard.tsx apps/habits/src/features/task/TaskCard.test.tsx apps/habits/src/features/task/TaskList.tsx apps/habits/src/features/task/TaskList.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): TaskCard / TaskList でタスク一覧表示

TaskCard: タスク名 + 時間帯 + 頻度サマリ + 編集/アーカイブ/復元ボタン。
TaskList: state\$.tasks + state\$.time_slots を購読し、active と archived に分離。
アーカイブ済は折りたたみ式で表示。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

> **注:** heredoc 内の `state$` は `state\$` とエスケープしないとシェルが変数展開してしまう（zsh の場合）。実際のコミット時には `state$.tasks` のままで書くこと（最終出力は同じ）。

---

## Task 7: `/tasks` ルート 3 つ + router 更新

**目的:** `/tasks` (TasksPage)、`/tasks/new` (TaskNewPage)、`/tasks/$id` (TaskEditPage) の 3 ルートを追加。AuthGate も同じ getCurrentSession ベース。

**Files:**
- Create: `apps/habits/src/routes/tasks/TasksPage.tsx`
- Create: `apps/habits/src/routes/tasks/TasksPage.test.tsx`
- Create: `apps/habits/src/routes/tasks/TaskNewPage.tsx`
- Create: `apps/habits/src/routes/tasks/TaskNewPage.test.tsx`
- Create: `apps/habits/src/routes/tasks/TaskEditPage.tsx`
- Create: `apps/habits/src/routes/tasks/TaskEditPage.test.tsx`
- Modify: `apps/habits/src/router.tsx`
- Modify: `apps/habits/src/App.test.tsx`

- [ ] **Step 1: `TasksPage.tsx`（一覧ページ）**

`apps/habits/src/routes/tasks/TasksPage.tsx`:

```tsx
import { Link, useNavigate } from '@tanstack/react-router';
import { TaskList } from '../../features/task/TaskList.js';

export function TasksPage(): React.ReactElement {
  const navigate = useNavigate();
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-game-accent">タスク管理</h1>
        <div className="flex items-center gap-2">
          <Link to="/today" className="text-sm text-game-accent underline">
            ← 今日のタスク
          </Link>
          <Link
            to="/tasks/new"
            className="rounded bg-game-accent px-3 py-1 text-sm font-medium text-game-bg"
          >
            新規追加
          </Link>
        </div>
      </header>
      <TaskList
        onEdit={(id) => {
          void navigate({ to: '/tasks/$id', params: { id } });
        }}
      />
    </section>
  );
}
```

`apps/habits/src/routes/tasks/TasksPage.test.tsx`:

```tsx
import { state$ } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TasksPage } from './TasksPage.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => <a href={props.to}>{props.children}</a>,
    useNavigate: () => vi.fn(),
  };
});

describe('TasksPage', () => {
  beforeEach(() => {
    state$.tasks.set({});
    state$.time_slots.set({});
  });

  it('「タスク管理」見出しと「新規追加」ボタンを表示する', () => {
    render(<TasksPage />);
    expect(screen.getByRole('heading', { name: 'タスク管理' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '新規追加' })).toBeInTheDocument();
  });

  it('「今日のタスク」へのリンクがある', () => {
    render(<TasksPage />);
    expect(screen.getByRole('link', { name: /今日のタスク/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: `TaskNewPage.tsx`（新規作成ページ）**

`apps/habits/src/routes/tasks/TaskNewPage.tsx`:

```tsx
import { use$ } from '@legendapp/state/react';
import { Link, useNavigate } from '@tanstack/react-router';
import { createTask, state$ } from '@org/habit-sync';
import { TaskForm } from '../../features/task/TaskForm.js';

export function TaskNewPage(): React.ReactElement {
  const navigate = useNavigate();
  const timeSlots = use$(() => {
    const slots = Object.values(state$.time_slots.get());
    return [...slots].sort((a, b) => a.sort_order - b.sort_order);
  });

  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-game-accent">新規タスク</h1>
        <Link to="/tasks" className="text-sm text-game-accent underline">
          ← 一覧へ戻る
        </Link>
      </header>
      <TaskForm
        timeSlots={timeSlots}
        submitLabel="作成"
        onSubmit={(values) => {
          // sort_order は同じ time_slot 内の最大値 + 1
          const sameSlotMax = Math.max(
            -1,
            ...Object.values(state$.tasks.get())
              .filter((t) => t.time_slot_id === values.time_slot_id)
              .map((t) => t.sort_order),
          );
          createTask({ ...values, sort_order: sameSlotMax + 1 });
          void navigate({ to: '/tasks' });
        }}
      />
    </section>
  );
}
```

`apps/habits/src/routes/tasks/TaskNewPage.test.tsx`:

```tsx
import { state$ } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskNewPage } from './TaskNewPage.js';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => <a href={props.to}>{props.children}</a>,
    useNavigate: () => navigateMock,
  };
});

describe('TaskNewPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    state$.user.set({ id: 'u1', email: 'a@b.co' } as never);
    state$.tasks.set({});
    state$.time_slots.set({
      s1: {
        id: 's1',
        user_id: 'u1',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('「新規タスク」見出しを表示する', () => {
    render(<TaskNewPage />);
    expect(screen.getByRole('heading', { name: '新規タスク' })).toBeInTheDocument();
  });

  it('submit すると state$.tasks に行が追加され /tasks に navigate される', () => {
    render(<TaskNewPage />);
    fireEvent.change(screen.getByLabelText('タスク名'), { target: { value: '新タスク' } });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    const tasks = Object.values(state$.tasks.get());
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.name).toBe('新タスク');
    expect(navigateMock).toHaveBeenCalledWith({ to: '/tasks' });
  });
});
```

- [ ] **Step 3: `TaskEditPage.tsx`（編集ページ）**

`apps/habits/src/routes/tasks/TaskEditPage.tsx`:

```tsx
import { use$ } from '@legendapp/state/react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { type Frequency } from '@org/habit-core';
import { archiveTask, state$, updateTask } from '@org/habit-sync';
import { TaskForm } from '../../features/task/TaskForm.js';

export function TaskEditPage(): React.ReactElement {
  const { id } = useParams({ from: '/tasks/$id' });
  const navigate = useNavigate();

  const result = use$(() => {
    const task = state$.tasks.get()[id];
    const slots = Object.values(state$.time_slots.get()).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    return { task, slots };
  });

  if (result.task === undefined) {
    return (
      <section className="mx-auto max-w-2xl p-6 space-y-4">
        <p className="text-sm text-red-400">タスクが見つかりません。</p>
        <Link to="/tasks" className="text-sm text-game-accent underline">
          ← 一覧へ戻る
        </Link>
      </section>
    );
  }

  const task = result.task;

  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-game-accent">タスクの編集</h1>
        <Link to="/tasks" className="text-sm text-game-accent underline">
          ← 一覧へ戻る
        </Link>
      </header>
      <TaskForm
        timeSlots={result.slots}
        initial={{
          name: task.name,
          time_slot_id: task.time_slot_id,
          frequency: task.frequency as unknown as Frequency,
        }}
        submitLabel="保存"
        onSubmit={(values) => {
          updateTask(id, values);
          void navigate({ to: '/tasks' });
        }}
      />
      <button
        type="button"
        onClick={() => {
          archiveTask(id);
          void navigate({ to: '/tasks' });
        }}
        className="rounded border border-red-500 px-3 py-1 text-sm text-red-400"
      >
        このタスクをアーカイブ
      </button>
    </section>
  );
}
```

`apps/habits/src/routes/tasks/TaskEditPage.test.tsx`:

```tsx
import { state$, type Task } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskEditPage } from './TaskEditPage.js';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => <a href={props.to}>{props.children}</a>,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: 't1' }),
  };
});

const baseTask: Task = {
  id: 't1',
  user_id: 'u1',
  time_slot_id: 's1',
  name: '元の名前',
  frequency: { type: 'daily' },
  sort_order: 0,
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('TaskEditPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    state$.user.set({ id: 'u1', email: 'a@b.co' } as never);
    state$.time_slots.set({
      s1: {
        id: 's1',
        user_id: 'u1',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    state$.tasks.set({ t1: baseTask });
  });

  it('既存タスクの値で初期化される', () => {
    render(<TaskEditPage />);
    expect(screen.getByLabelText('タスク名')).toHaveValue('元の名前');
  });

  it('保存ボタンで updateTask が state$ に反映される', () => {
    render(<TaskEditPage />);
    fireEvent.change(screen.getByLabelText('タスク名'), { target: { value: '更新後' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(state$.tasks.get().t1?.name).toBe('更新後');
    expect(navigateMock).toHaveBeenCalledWith({ to: '/tasks' });
  });

  it('アーカイブボタンで archived_at がセットされ navigate される', () => {
    render(<TaskEditPage />);
    fireEvent.click(screen.getByRole('button', { name: 'このタスクをアーカイブ' }));
    expect(state$.tasks.get().t1?.archived_at).not.toBeNull();
    expect(navigateMock).toHaveBeenCalledWith({ to: '/tasks' });
  });

  it('存在しない id は「タスクが見つかりません」を表示', () => {
    state$.tasks.set({});
    render(<TaskEditPage />);
    expect(screen.getByText(/タスクが見つかりません/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: `router.tsx` 更新**

`apps/habits/src/router.tsx` を以下に置き換える:

```tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { Login } from './features/auth/Login.js';
import { Signup } from './features/auth/Signup.js';
import { Today } from './features/today/Today.js';
import { getCurrentSession } from './lib/auth.js';
import { getAppSupabase } from './lib/supabase.js';
import { SettingsTimeSlotsPage } from './routes/settings/SettingsTimeSlotsPage.js';
import { TaskEditPage } from './routes/tasks/TaskEditPage.js';
import { TaskNewPage } from './routes/tasks/TaskNewPage.js';
import { TasksPage } from './routes/tasks/TasksPage.js';

const rootRoute = createRootRoute({
  component: () => (
    <main className="min-h-screen">
      <Outlet />
    </main>
  ),
});

// 認証必須ルート用の共通 beforeLoad
async function requireAuth(): Promise<void> {
  const session = await getCurrentSession(getAppSupabase());
  if (session === null) {
    throw redirect({ to: '/auth/login' });
  }
}

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
  beforeLoad: requireAuth,
  component: Today,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  beforeLoad: requireAuth,
  component: TasksPage,
});

const taskNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks/new',
  beforeLoad: requireAuth,
  component: TaskNewPage,
});

const taskEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks/$id',
  beforeLoad: requireAuth,
  component: TaskEditPage,
});

const settingsTimeSlotsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/time-slots',
  beforeLoad: requireAuth,
  component: SettingsTimeSlotsPage,
});

const authLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: Login,
});

const authSignupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/signup',
  component: Signup,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  tasksRoute,
  taskNewRoute,
  taskEditRoute,
  settingsTimeSlotsRoute,
  authLoginRoute,
  authSignupRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

> **注:** Task 9 で `SettingsTimeSlotsPage` を実装するまで本 import は壊れる。順序: Task 8 / 9 を先にやれば import エラーは出ない。本プランでは Task 7 → 8 → 9 の順なので、Task 7 の router.tsx は SettingsTimeSlotsPage を一旦コメントアウトするか、Task 9 で再度 router.tsx を編集する方針を選ぶ。

**統一して Task 9 で router.tsx の最終形を実装する案にする:** Task 7 では `/tasks` 系 3 ルートのみ追加し、`SettingsTimeSlotsPage` の import / route は Task 9 で追加。Task 7 用の router.tsx は次のとおり:

```tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { Login } from './features/auth/Login.js';
import { Signup } from './features/auth/Signup.js';
import { Today } from './features/today/Today.js';
import { getCurrentSession } from './lib/auth.js';
import { getAppSupabase } from './lib/supabase.js';
import { TaskEditPage } from './routes/tasks/TaskEditPage.js';
import { TaskNewPage } from './routes/tasks/TaskNewPage.js';
import { TasksPage } from './routes/tasks/TasksPage.js';

const rootRoute = createRootRoute({
  component: () => (
    <main className="min-h-screen">
      <Outlet />
    </main>
  ),
});

async function requireAuth(): Promise<void> {
  const session = await getCurrentSession(getAppSupabase());
  if (session === null) {
    throw redirect({ to: '/auth/login' });
  }
}

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
  beforeLoad: requireAuth,
  component: Today,
});

const tasksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks',
  beforeLoad: requireAuth,
  component: TasksPage,
});

const taskNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks/new',
  beforeLoad: requireAuth,
  component: TaskNewPage,
});

const taskEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tasks/$id',
  beforeLoad: requireAuth,
  component: TaskEditPage,
});

const authLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/login',
  component: Login,
});

const authSignupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/signup',
  component: Signup,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  tasksRoute,
  taskNewRoute,
  taskEditRoute,
  authLoginRoute,
  authSignupRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 5: `App.test.tsx` に新ルートのテストを追加**

`apps/habits/src/App.test.tsx` の既存テスト群の末尾に、`describe('App ルーティング', ...)` の最後の `it` の後に追加:

```ts
  it('認証済みで /tasks にアクセスすると「タスク管理」ページが表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/tasks');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'タスク管理' })).toBeInTheDocument();
    });
  });

  it('未認証で /tasks にアクセスすると /auth/login へリダイレクトされる', async () => {
    getCurrentSessionMock.mockResolvedValue(null);
    await navigate('/tasks');
    render(<App />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });
  });
```

- [ ] **Step 6: テスト通過確認 + コミット**

```bash
CI=true pnpm nx run-many -t typecheck lint test --skip-nx-cache
pnpm exec biome ci .
```

Expected: 全プロジェクト緑。新規テスト: TasksPage 2 + TaskNewPage 2 + TaskEditPage 4 + App.test 新規 2 = 10 件追加。

```bash
git add apps/habits/src/routes/tasks/ apps/habits/src/router.tsx apps/habits/src/App.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): /tasks 系 3 ルートを追加 + 共通 AuthGate

- /tasks: TasksPage (TaskList 描画 + 新規追加リンク)
- /tasks/new: TaskNewPage (新規作成フォーム)
- /tasks/$id: TaskEditPage (編集 + アーカイブボタン)
- router.tsx の AuthGate を requireAuth() に抽出して全認証ルートで共有

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `TimeSlotEditor` + `TimeSlotList` コンポーネント

**目的:** TimeSlot 1 件のフォーム（新規作成も編集も） + 一覧表示。一覧に追加ボタンと「削除」(条件を満たさない場合は理由表示)。

**Files:**
- Create: `apps/habits/src/features/timeslot/TimeSlotEditor.tsx`
- Create: `apps/habits/src/features/timeslot/TimeSlotEditor.test.tsx`
- Create: `apps/habits/src/features/timeslot/TimeSlotList.tsx`
- Create: `apps/habits/src/features/timeslot/TimeSlotList.test.tsx`

- [ ] **Step 1: `TimeSlotEditor.tsx` のテスト作成**

`apps/habits/src/features/timeslot/TimeSlotEditor.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeSlotEditor } from './TimeSlotEditor.js';

describe('TimeSlotEditor', () => {
  it('name と notify_at の入力欄を表示する', () => {
    render(<TimeSlotEditor onSubmit={vi.fn()} onCancel={vi.fn()} submitLabel="作成" />);
    expect(screen.getByLabelText('時間帯名')).toBeInTheDocument();
    expect(screen.getByLabelText('通知時刻')).toBeInTheDocument();
  });

  it('initial を渡すと値で初期化される', () => {
    render(
      <TimeSlotEditor
        initial={{ name: '朝', notify_at: '07:30:00' }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="保存"
      />,
    );
    expect(screen.getByLabelText('時間帯名')).toHaveValue('朝');
    expect(screen.getByLabelText('通知時刻')).toHaveValue('07:30');
  });

  it('submit で onSubmit が呼ばれる (notify_at は HH:MM:SS に補完される)', () => {
    const onSubmit = vi.fn();
    render(<TimeSlotEditor onSubmit={onSubmit} onCancel={vi.fn()} submitLabel="作成" />);
    fireEvent.change(screen.getByLabelText('時間帯名'), { target: { value: '夜' } });
    fireEvent.change(screen.getByLabelText('通知時刻'), { target: { value: '21:00' } });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    expect(onSubmit).toHaveBeenCalledWith({ name: '夜', notify_at: '21:00:00' });
  });

  it('name が空のときは onSubmit を呼ばずエラーを表示する', () => {
    const onSubmit = vi.fn();
    render(<TimeSlotEditor onSubmit={onSubmit} onCancel={vi.fn()} submitLabel="作成" />);
    fireEvent.change(screen.getByLabelText('通知時刻'), { target: { value: '07:00' } });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/時間帯名/);
  });

  it('キャンセルボタンで onCancel が呼ばれる', () => {
    const onCancel = vi.fn();
    render(<TimeSlotEditor onSubmit={vi.fn()} onCancel={onCancel} submitLabel="作成" />);
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: `TimeSlotEditor.tsx` 実装**

`apps/habits/src/features/timeslot/TimeSlotEditor.tsx`:

```tsx
import { type FormEvent, useState } from 'react';

export interface TimeSlotEditorValues {
  name: string;
  notify_at: string; // 'HH:MM:SS'
}

export interface TimeSlotEditorProps {
  initial?: TimeSlotEditorValues;
  onSubmit: (values: TimeSlotEditorValues) => void;
  onCancel: () => void;
  submitLabel: string;
}

// 'HH:MM:SS' → 'HH:MM'（input[type=time] は HH:MM のみ受け付ける）
function trimSeconds(s: string): string {
  return s.slice(0, 5);
}

// 'HH:MM' → 'HH:MM:00'
function withSeconds(s: string): string {
  return s.length === 5 ? `${s}:00` : s;
}

export function TimeSlotEditor({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: TimeSlotEditorProps): React.ReactElement {
  const [name, setName] = useState(initial?.name ?? '');
  const [notifyAt, setNotifyAt] = useState(trimSeconds(initial?.notify_at ?? '07:00:00'));
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (name.trim() === '') {
      setValidationError('時間帯名を入力してください。');
      return;
    }
    setValidationError(null);
    onSubmit({ name: name.trim(), notify_at: withSeconds(notifyAt) });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded border border-gray-600 p-3">
      <label className="block space-y-1">
        <span className="text-sm">時間帯名</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full rounded border border-gray-500 bg-transparent px-2 py-1"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm">通知時刻</span>
        <input
          type="time"
          value={notifyAt}
          onChange={(e) => setNotifyAt(e.target.value)}
          className="block rounded border border-gray-500 bg-transparent px-2 py-1"
        />
      </label>
      {validationError !== null && (
        <p role="alert" className="text-sm text-red-400">
          {validationError}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-game-accent px-3 py-1 text-sm font-medium text-game-bg"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: `TimeSlotEditor` テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/timeslot/TimeSlotEditor.test.tsx
```

Expected: 5 件 pass。

- [ ] **Step 4: `TimeSlotList.tsx` のテスト作成**

`apps/habits/src/features/timeslot/TimeSlotList.test.tsx`:

```tsx
import { state$ } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TimeSlotList } from './TimeSlotList.js';

const fakeUser = { id: 'u1', email: 'a@b.co' };

describe('TimeSlotList', () => {
  beforeEach(() => {
    state$.user.set(fakeUser as never);
    state$.tasks.set({});
    state$.time_slots.set({
      s1: {
        id: 's1',
        user_id: 'u1',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      s2: {
        id: 's2',
        user_id: 'u1',
        name: '夜',
        notify_at: '21:00:00',
        sort_order: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('登録済み時間帯を sort_order 順で表示する', () => {
    render(<TimeSlotList />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('朝');
    expect(items[0]).toHaveTextContent('07:00');
    expect(items[1]).toHaveTextContent('夜');
  });

  it('「追加」ボタンでエディタが表示される', () => {
    render(<TimeSlotList />);
    fireEvent.click(screen.getByRole('button', { name: /時間帯を追加/ }));
    expect(screen.getByLabelText('時間帯名')).toBeInTheDocument();
  });

  it('エディタで新規作成すると state$.time_slots に追加される', () => {
    render(<TimeSlotList />);
    fireEvent.click(screen.getByRole('button', { name: /時間帯を追加/ }));
    fireEvent.change(screen.getByLabelText('時間帯名'), { target: { value: '昼' } });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    const slots = Object.values(state$.time_slots.get());
    expect(slots.find((s) => s.name === '昼')).toBeDefined();
  });

  it('削除ボタンで参照タスクなしのスロットを削除できる', () => {
    render(<TimeSlotList />);
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(deleteButtons[0]);
    expect(Object.keys(state$.time_slots.get())).toHaveLength(1);
  });

  it('参照タスクがあるスロットの削除は失敗し alert が表示される', () => {
    state$.tasks.set({
      t1: {
        id: 't1',
        user_id: 'u1',
        time_slot_id: 's1',
        name: '歯磨き',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    render(<TimeSlotList />);
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(deleteButtons[0]); // s1 削除を試みる
    expect(screen.getByRole('alert')).toHaveTextContent(/タスク/);
    expect(state$.time_slots.get().s1).toBeDefined(); // 削除されていない
  });
});
```

- [ ] **Step 5: `TimeSlotList.tsx` 実装**

`apps/habits/src/features/timeslot/TimeSlotList.tsx`:

```tsx
import { use$ } from '@legendapp/state/react';
import { createTimeSlot, deleteTimeSlot, state$, updateTimeSlot } from '@org/habit-sync';
import { useState } from 'react';
import { TimeSlotEditor, type TimeSlotEditorValues } from './TimeSlotEditor.js';

type Mode = { type: 'list' } | { type: 'new' } | { type: 'edit'; id: string };

function trimSeconds(s: string): string {
  return s.slice(0, 5);
}

export function TimeSlotList(): React.ReactElement {
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const slots = use$(() => {
    return Object.values(state$.time_slots.get()).sort((a, b) => a.sort_order - b.sort_order);
  });

  const handleCreate = (values: TimeSlotEditorValues): void => {
    const maxOrder = Math.max(-1, ...slots.map((s) => s.sort_order));
    createTimeSlot({ ...values, sort_order: maxOrder + 1 });
    setMode({ type: 'list' });
    setErrorMessage(null);
  };

  const handleUpdate = (id: string, values: TimeSlotEditorValues): void => {
    updateTimeSlot(id, values);
    setMode({ type: 'list' });
    setErrorMessage(null);
  };

  const handleDelete = (id: string): void => {
    setErrorMessage(null);
    const result = deleteTimeSlot(id);
    if (!result.ok) {
      setErrorMessage(result.reason);
    }
  };

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {slots.map((s) =>
          mode.type === 'edit' && mode.id === s.id ? (
            <li key={s.id}>
              <TimeSlotEditor
                initial={{ name: s.name, notify_at: s.notify_at }}
                onSubmit={(values) => handleUpdate(s.id, values)}
                onCancel={() => setMode({ type: 'list' })}
                submitLabel="保存"
              />
            </li>
          ) : (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded border border-gray-700 p-3"
            >
              <div className="flex-1 space-y-1">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-gray-400">{trimSeconds(s.notify_at)}</div>
              </div>
              <button
                type="button"
                onClick={() => setMode({ type: 'edit', id: s.id })}
                className="rounded border border-gray-500 px-3 py-1 text-sm"
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                className="rounded border border-red-500 px-3 py-1 text-sm text-red-400"
              >
                削除
              </button>
            </li>
          ),
        )}
      </ul>

      {errorMessage !== null && (
        <p role="alert" className="text-sm text-red-400">
          {errorMessage}
        </p>
      )}

      {mode.type === 'new' ? (
        <TimeSlotEditor
          onSubmit={handleCreate}
          onCancel={() => setMode({ type: 'list' })}
          submitLabel="作成"
        />
      ) : (
        <button
          type="button"
          onClick={() => setMode({ type: 'new' })}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          時間帯を追加
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: `TimeSlotList` テスト通過確認 + コミット**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/timeslot/
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/timeslot/
git commit -m "$(cat <<'EOF'
feat(habits): TimeSlotEditor + TimeSlotList で時間帯 CRUD UI

TimeSlotEditor: 新規・編集共通のフォーム (name + notify_at)。
TimeSlotList: 一覧表示 + インライン編集 + 追加 + 削除。
削除は deleteTimeSlot のガード違反時に reason を alert 表示。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `/settings/time-slots` ルート + router 更新

**目的:** `/settings/time-slots` で TimeSlotList を表示。router に追加して AuthGate を共有。

**Files:**
- Create: `apps/habits/src/routes/settings/SettingsTimeSlotsPage.tsx`
- Create: `apps/habits/src/routes/settings/SettingsTimeSlotsPage.test.tsx`
- Modify: `apps/habits/src/router.tsx`
- Modify: `apps/habits/src/App.test.tsx`

- [ ] **Step 1: `SettingsTimeSlotsPage.tsx`**

`apps/habits/src/routes/settings/SettingsTimeSlotsPage.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import { TimeSlotList } from '../../features/timeslot/TimeSlotList.js';

export function SettingsTimeSlotsPage(): React.ReactElement {
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-game-accent">時間帯の設定</h1>
        <Link to="/today" className="text-sm text-game-accent underline">
          ← 今日のタスク
        </Link>
      </header>
      <TimeSlotList />
    </section>
  );
}
```

`apps/habits/src/routes/settings/SettingsTimeSlotsPage.test.tsx`:

```tsx
import { state$ } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsTimeSlotsPage } from './SettingsTimeSlotsPage.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => <a href={props.to}>{props.children}</a>,
  };
});

describe('SettingsTimeSlotsPage', () => {
  beforeEach(() => {
    state$.user.set({ id: 'u1', email: 'a@b.co' } as never);
    state$.tasks.set({});
    state$.time_slots.set({});
  });

  it('「時間帯の設定」見出しを表示する', () => {
    render(<SettingsTimeSlotsPage />);
    expect(screen.getByRole('heading', { name: '時間帯の設定' })).toBeInTheDocument();
  });

  it('「今日のタスク」リンクがある', () => {
    render(<SettingsTimeSlotsPage />);
    expect(screen.getByRole('link', { name: /今日のタスク/ })).toBeInTheDocument();
  });

  it('TimeSlotList の「時間帯を追加」ボタンが見える', () => {
    render(<SettingsTimeSlotsPage />);
    expect(screen.getByRole('button', { name: /時間帯を追加/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: `router.tsx` 更新（SettingsTimeSlotsPage を追加）**

既存の `router.tsx` の `taskEditRoute` の後に追加し、`routeTree` にも組み込む:

```tsx
// 既存の import 文に追加
import { SettingsTimeSlotsPage } from './routes/settings/SettingsTimeSlotsPage.js';

// taskEditRoute の後に追加
const settingsTimeSlotsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/time-slots',
  beforeLoad: requireAuth,
  component: SettingsTimeSlotsPage,
});

// addChildren の引数に追加
const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  tasksRoute,
  taskNewRoute,
  taskEditRoute,
  settingsTimeSlotsRoute,
  authLoginRoute,
  authSignupRoute,
]);
```

- [ ] **Step 3: `App.test.tsx` にテストを追加**

`apps/habits/src/App.test.tsx` の末尾に追加:

```ts
  it('認証済みで /settings/time-slots にアクセスすると「時間帯の設定」が表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/settings/time-slots');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '時間帯の設定' })).toBeInTheDocument();
    });
  });
```

- [ ] **Step 4: テスト通過確認 + コミット**

```bash
CI=true pnpm nx run-many -t typecheck lint test --skip-nx-cache
pnpm exec biome ci .
git add apps/habits/src/routes/settings/ apps/habits/src/router.tsx apps/habits/src/App.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): /settings/time-slots ルートを追加

SettingsTimeSlotsPage で TimeSlotList を描画。
router.tsx に requireAuth 共有の beforeLoad で追加。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Today 画面ヘッダーに導線リンクを追加

**目的:** Today 画面のヘッダー右に「タスク管理」「設定」リンクを並べる。ログアウトボタンは維持。

**Files:**
- Modify: `apps/habits/src/features/today/Today.tsx`
- Modify: `apps/habits/src/features/today/Today.test.tsx`

- [ ] **Step 1: `Today.tsx` を更新**

`apps/habits/src/features/today/Today.tsx` の `<header>` ブロックを以下に置き換える:

```tsx
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-game-accent">今日のタスク</h1>
        <nav className="flex items-center gap-2">
          <Link
            to="/tasks"
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            タスク管理
          </Link>
          <Link
            to="/settings/time-slots"
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            設定
          </Link>
          <button
            type="button"
            onClick={() => {
              void handleSignOut();
            }}
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            ログアウト
          </button>
        </nav>
      </header>
```

`Today.tsx` の import 文に `Link` を追加:

```tsx
import { Link, useNavigate } from '@tanstack/react-router';
```

- [ ] **Step 2: `Today.test.tsx` にリンクテストを追加**

既存の `Today.test.tsx` の最後の `it` の後に追加:

```ts
  it('タスク管理リンクが表示される', () => {
    render(<Today />);
    expect(screen.getByRole('link', { name: 'タスク管理' })).toBeInTheDocument();
  });

  it('設定リンクが表示される', () => {
    render(<Today />);
    expect(screen.getByRole('link', { name: '設定' })).toBeInTheDocument();
  });
```

> **注:** `vi.mock('@tanstack/react-router', ...)` の中で `Link` も mock 化される必要がある。既存の mock が `useNavigate` のみ override しているなら、`Link` も `<a href={to}>` 形式で追加する:

```ts
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => <a href={props.to}>{props.children}</a>,
    useNavigate: (): typeof navigateMock => navigateMock,
  };
});
```

Read 既存の `Today.test.tsx` を確認し、必要に応じて Link mock を追加すること。

- [ ] **Step 3: テスト通過確認 + コミット**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/Today.test.tsx
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/today/Today.tsx apps/habits/src/features/today/Today.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): Today 画面ヘッダーに /tasks /settings リンク追加

ログアウトの隣に「タスク管理」「設定」を並べた nav を追加。
Today.test.tsx は Link mock を補強してリンク表示を 2 件検証。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: (任意) 手動 E2E 検証 + CLAUDE.md 追記

**目的:** ローカル Supabase + dev サーバーで Task CRUD + TimeSlot CRUD を実際にウォークスルー。CLAUDE.md に M7 メモを追記。

**Files:**
- Modify: `CLAUDE.md`

### 検証手順

- [ ] **Step 1: 環境準備 + signup**

```bash
supabase start && supabase db reset
pnpm nx serve habits
```

ブラウザで `/auth/signup` で新規登録 → `/today` 着地。

- [ ] **Step 2: タスク CRUD**

ヘッダー「タスク管理」をクリック → `/tasks`。

- 「新規追加」→ name 入力 + 頻度を「N 日ごと」に変更 + 「作成」→ /tasks に戻る、新タスクが一覧表示される
- 既存タスクの「編集」→ 名前変更 + 「保存」→ /tasks に戻り、変更が反映
- 「アーカイブ」→ /tasks に戻り、active リストから消える
- 「アーカイブ済を表示」→ 折り畳みが開く → 「復元」→ active に戻る

psql で確認:

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT id, name, archived_at FROM tasks ORDER BY created_at DESC LIMIT 5;"
```

- [ ] **Step 3: 時間帯 CRUD**

ヘッダー「設定」→ `/settings/time-slots`。

- 「時間帯を追加」→ name + 時刻 → 作成
- 既存の「編集」→ 値変更 → 保存
- 「削除」→ 参照タスク無し / 2 件以上残るなら削除、それ以外は alert で理由表示

- [ ] **Step 4: CLAUDE.md に M7 メモ追記**

`/Users/ikomiki/workspace/daily-task/CLAUDE.md` の `### Today 画面（M6 以降）` セクションの後（`## E2E（Playwright）` の前）に追加:

```markdown

### タスク管理 / 時間帯設定（M7 以降）

- `/tasks`: TaskList で全タスクを一覧表示、新規追加 / 編集 / アーカイブ / 復元
- `/tasks/new` / `/tasks/$id`: TaskForm で新規・編集（FrequencyPicker 内包）
- `/settings/time-slots`: 時間帯の CRUD。最低 1 個と参照タスクなしのガードあり
- 書き込みヘルパー: `@org/habit-sync` の `createTask` / `updateTask` / `archiveTask` / `unarchiveTask` / `createTimeSlot` / `updateTimeSlot` / `deleteTimeSlot`
- 頻度サマリ表示: `apps/habits/src/lib/frequency-format.ts` の `formatFrequency`
- 全認証ルートは `router.tsx` 内の `requireAuth()` 共通 beforeLoad で AuthGate を共有
```

- [ ] **Step 5: コミット**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: CLAUDE.md に M7 タスク管理 / 時間帯設定の運用メモを追記

ルート構成、書き込みヘルパー、頻度サマリ、AuthGate 共通化の場所をメモ。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

> **このタスクをスキップする判断:** Docker / Supabase CLI が無ければスキップ可。component test と App.test の routing 検証で機能網羅済み。

---

## 次のマイルストーン

このプラン完了後、次は **M8: スタッシュ表示（StashPanel + PendingSyncBadge）** の実装プラン。M8 で扱う内容:

- `task_stash_view` の購読 → 各タスクの complete_count / fail_count / skip_count / current_streak / task_days / completion_rate を表示
- `PendingSyncBadge`: `getPendingSyncCount(state$)` を購読、1 件以上で「同期前」表示
- `online$` を購読し offline 時の表示も切替
- TaskCard / TodayTaskItem との統合（任意）

---

## 自己レビュー結果

仕様カバレッジ（§5.1 / §5.2 / §6.2）:

- ✅ Task CRUD: Task 1 (writers) + Task 5-7 (UI + routes)
- ✅ FrequencyPicker 5 type: Task 4
- ✅ TimeSlot CRUD + 最低 1 個ガード + 参照タスクガード: Task 2 + Task 8-9
- ✅ アーカイブ / 復元: Task 6 (TaskList) + Task 7 (TaskEditPage)
- ✅ Today からの導線: Task 10
- ✅ `state$` 楽観更新 → syncedSupabase 経由で Supabase 同期 (M5 で接続済)

型整合性:

- `CreateTaskInput { name, time_slot_id, frequency, sort_order }` Task 1 で定義、Task 5 (TaskForm) と Task 7 (TaskNewPage) で消費
- `UpdateTaskInput` も Task 1 で定義、Task 7 (TaskEditPage) で消費
- `DeleteResult = { ok: true } | { ok: false; reason: string }` Task 2 で定義、Task 8 (TimeSlotList) で消費
- `TaskFormValues { name, time_slot_id, frequency }` Task 5 で定義、TaskNewPage / TaskEditPage で onSubmit 受け取り
- `TimeSlotEditorValues { name, notify_at }` Task 8 で定義、TimeSlotList の onSubmit で受ける
- `Frequency` は `@org/habit-core` (M4) から、各所で `as unknown as Frequency` で Json → 判別共用体に narrow

プレースホルダ:

- なし。すべて具体的なテスト / 実装 / コマンドを記述。
- legend-state v3 beta の `.delete()` は M6 で動作確認済のため Task 2 でも採用。

リスク（実装時に注意）:

- **`router.tsx` の編集順:** Task 7 で `/tasks` 系を追加、Task 9 で `/settings/time-slots` を追加する 2 段構え。Task 7 用と Task 9 用の `router.tsx` をそれぞれ示している。Task 9 で追加するのは 1 つの import + 1 つの createRoute + addChildren 配列への 1 行追加だけ。
- **Today.test.tsx の Link mock:** 既存テスト（M6 で実装）は `Link` を mock 化していない可能性がある。Task 10 Step 2 の注記に従い、Link mock を補強する。
- **`Task.frequency` の Json 型から `Frequency` への narrow:** Database 型では `Json` だが、実体は `Frequency` 判別共用体と等価。`as unknown as Frequency` 二段キャストで narrow（M5 で同じ pattern を採用済）。
