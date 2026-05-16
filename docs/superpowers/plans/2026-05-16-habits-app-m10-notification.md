# Habits App M10: 通知 v1 (NotificationProvider + フォアグラウンドスケジューラ) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ブラウザの Notification API を使ったフォアグラウンド通知を実装する。`WebNotificationProvider` が `Notification` 抽象を実装し、`NotificationManager` が `state$.time_slots` を購読して各 slot の `notify_at` 時刻に `setTimeout` で発火、当日中の未操作タスクのみを通知する。`/settings/notifications` ページで権限を要求／状態を表示。

**Architecture:** `packages/habit-sync` の `NotificationProvider` インターフェースを少し拡張（`scheduleDaily` に `onFire(slot)` callback を渡せるよう変更、`show(title, body?)` を追加）。`WebNotificationProvider` がブラウザ実装、`NotificationManager` がアプリ側オーケストレーター。発火時のタスク絞り込みは純粋関数 `getSlotPendingNotificationTasks` を `apps/habits/src/lib/` に分離してテスト容易にする。スケジュールは「当日中」のみ（DST／日跨ぎは v1 スコープ外）。

**Tech Stack:** React 19, legend-state v3 beta (`use$`), Notification API, `setTimeout`, vitest + testing-library + fake timers

---

## ファイル構成

新規作成:

| パス | 責務 |
|---|---|
| `packages/habit-sync/src/notify/WebNotificationProvider.ts` | Notification API + setTimeout の v1 実装 |
| `packages/habit-sync/src/notify/WebNotificationProvider.test.ts` | 上記のユニットテスト（fake timers） |
| `apps/habits/src/lib/slot-pending.ts` | スロット時刻発火時に通知すべき未操作タスクを抽出する純粋関数 |
| `apps/habits/src/lib/slot-pending.test.ts` | 上記のテスト |
| `apps/habits/src/hooks/useNotificationPermission.ts` | `Notification.permission` を React state として購読 |
| `apps/habits/src/hooks/useNotificationPermission.test.tsx` | 上記のテスト |
| `apps/habits/src/features/notify/NotificationManager.tsx` | state$ ↔ NotificationProvider のオーケストレーター（UI 無し） |
| `apps/habits/src/features/notify/NotificationManager.test.tsx` | 上記のテスト |
| `apps/habits/src/routes/settings/SettingsNotificationsPage.tsx` | `/settings/notifications` ページ |
| `apps/habits/src/routes/settings/SettingsNotificationsPage.test.tsx` | 上記のテスト |

修正:

| パス | 修正内容 |
|---|---|
| `packages/habit-sync/src/notify/NotificationProvider.ts` | `scheduleDaily` に onFire 引数、`show(title, body?)` メソッドを追加 |
| `packages/habit-sync/src/index.ts` | `WebNotificationProvider` を re-export |
| `apps/habits/src/router.tsx` | `/settings/notifications` ルートを `requireAuth` 付きで追加、`NotificationManager` を root に mount |
| `apps/habits/src/App.test.tsx` | `/settings/notifications` 着地テスト 1 件追加 |
| `apps/habits/src/routes/settings/SettingsTimeSlotsPage.tsx` | header に「通知設定」リンクを追加 |
| `apps/habits/src/routes/settings/SettingsTimeSlotsPage.test.tsx` | 通知設定リンク表示テスト 1 件追加 |
| `CLAUDE.md` | 「通知 v1（M10 以降）」セクションを追加 |

データ流れ:

```
state$.time_slots ─┐
state$.tasks      ─┤  購読 / 変化検知
state$.task_logs  ─┤
                  ↓
            NotificationManager
            ├─ 起動 / time_slots 変化時:
            │     provider.cancelAll() → provider.scheduleDaily(slots, onFire)
            │
            └─ onFire(slot) [スロット時刻に発火]:
                  getSlotPendingNotificationTasks(slot.id, today, state$ 読出) → Task[]
                  if (pending.length > 0) provider.show(slot.name, "X 件のタスクがあります")
```

権限フロー:

```
SettingsNotificationsPage
  ├─ 現在の Notification.permission を useNotificationPermission で表示
  └─ 「通知を許可する」ボタン → provider.requestPermission() → state 更新
```

v1 スコープ外:
- 日跨ぎの自動再スケジュール（アプリを開いたまま 0:00 を跨ぐと翌日分は鳴らない）
- DST / タイムゾーン変更ハンドリング
- Service Worker / Web Push（タブを閉じても鳴る通知）
- タスクごとの通知（v1 は「slot に X 件の未操作タスク」サマリのみ）

---

## Task 1: NotificationProvider インターフェース拡張

**Files:**
- Modify: `packages/habit-sync/src/notify/NotificationProvider.ts`

`scheduleDaily` を `(slots, onFire) => void` に変更し、`show(title, body?)` メソッドを追加。`SlotSchedule` はそのまま。

- [ ] **Step 1: NotificationProvider を更新**

`packages/habit-sync/src/notify/NotificationProvider.ts` を以下の完全な内容で置き換え:

```ts
// 通知バックエンドの抽象。
// v1 = WebNotificationProvider（フォアグラウンドのみ）
// 将来 = TauriNotificationProvider（tauri-plugin-notification）
// 詳細: docs/superpowers/specs/2026-05-16-habits-app-design.md §7.3

export type PermissionState = 'granted' | 'denied' | 'prompt';

export interface SlotSchedule {
  slotId: string;
  slotName: string;
  notifyAt: string; // 'HH:MM' または 'HH:MM:SS' 形式（ローカル）
}

// scheduleDaily の onFire は、各スロットの notifyAt 時刻に呼び出される。
// 呼び出された側で state$ から「未操作タスク」を抽出し、provider.show() で通知発火する。
// この間接化により、scheduleDaily 時点の snapshot ではなく発火時点の最新 state で判定できる。
export interface NotificationProvider {
  requestPermission(): Promise<PermissionState>;
  scheduleDaily(slots: SlotSchedule[], onFire: (slot: SlotSchedule) => void): void;
  cancelAll(): void;
  show(title: string, body?: string): void;
}
```

- [ ] **Step 2: 型レベルの整合性チェック**

```bash
cd /Users/ikomiki/workspace/daily-task && CI=true pnpm nx typecheck @org/habit-sync
```

Expected: PASS（既存実装は無いので壊れる箇所も無いはず）

- [ ] **Step 3: コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && git add packages/habit-sync/src/notify/NotificationProvider.ts && git commit -m "feat(habit-sync): extend NotificationProvider with onFire callback and show()"
```

---

## Task 2: WebNotificationProvider 実装

**Files:**
- Create: `packages/habit-sync/src/notify/WebNotificationProvider.ts`
- Test: `packages/habit-sync/src/notify/WebNotificationProvider.test.ts`
- Modify: `packages/habit-sync/src/index.ts`

ブラウザの `Notification` API + `setTimeout` を使った v1 実装。`now()` を DI 可能にしてテストで時計を制御できるようにする。

- [ ] **Step 1: 失敗するテストを作成**

`packages/habit-sync/src/notify/WebNotificationProvider.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SlotSchedule } from './NotificationProvider.js';
import { WebNotificationProvider } from './WebNotificationProvider.js';

interface NotifInstance {
  title: string;
  body?: string;
}

// Notification グローバルをモック
class NotificationMock {
  static permission: 'granted' | 'denied' | 'default' = 'default';
  static requestPermissionMock = vi.fn();
  static requestPermission(): Promise<'granted' | 'denied' | 'default'> {
    return NotificationMock.requestPermissionMock();
  }
  title: string;
  body?: string;
  constructor(title: string, options?: { body?: string }) {
    this.title = title;
    this.body = options?.body;
    instances.push({ title, body: options?.body });
  }
}

let instances: NotifInstance[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  instances = [];
  NotificationMock.permission = 'default';
  NotificationMock.requestPermissionMock.mockReset();
  // biome-ignore lint/suspicious/noExplicitAny: テスト用グローバル差し替え
  (globalThis as any).Notification = NotificationMock;
});

afterEach(() => {
  vi.useRealTimers();
  // biome-ignore lint/suspicious/noExplicitAny: テスト用グローバル復元
  delete (globalThis as any).Notification;
});

function fixedNow(hh: number, mm: number): () => Date {
  return () => {
    const d = new Date(2026, 4, 16, hh, mm, 0, 0); // 2026-05-16 ローカル
    return d;
  };
}

describe('WebNotificationProvider', () => {
  it('requestPermission は Notification.requestPermission() を呼び 結果を正規化する', async () => {
    NotificationMock.requestPermissionMock.mockResolvedValue('granted');
    const provider = new WebNotificationProvider({ now: fixedNow(9, 0) });
    await expect(provider.requestPermission()).resolves.toBe('granted');
    expect(NotificationMock.requestPermissionMock).toHaveBeenCalled();
  });

  it('requestPermission の戻り値 "default" は "prompt" に正規化', async () => {
    NotificationMock.requestPermissionMock.mockResolvedValue('default');
    const provider = new WebNotificationProvider({ now: fixedNow(9, 0) });
    await expect(provider.requestPermission()).resolves.toBe('prompt');
  });

  it('Notification API 未対応環境では requestPermission が "denied" を返す', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    delete (globalThis as any).Notification;
    const provider = new WebNotificationProvider({ now: fixedNow(9, 0) });
    await expect(provider.requestPermission()).resolves.toBe('denied');
  });

  it('scheduleDaily: 未来時刻のスロットを setTimeout で予約し、時刻到達で onFire が呼ばれる', () => {
    const provider = new WebNotificationProvider({ now: fixedNow(8, 0) });
    const onFire = vi.fn();
    const slots: SlotSchedule[] = [
      { slotId: 's1', slotName: '朝', notifyAt: '09:00' },
      { slotId: 's2', slotName: '夜', notifyAt: '21:00' },
    ];
    provider.scheduleDaily(slots, onFire);

    // 09:00 まで進める（1 時間 = 60 * 60 * 1000ms）
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith(slots[0]);

    // さらに 12 時間進めて 21:00 へ
    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenLastCalledWith(slots[1]);
  });

  it('scheduleDaily: 過去時刻のスロットは setTimeout を発行しない', () => {
    const provider = new WebNotificationProvider({ now: fixedNow(10, 0) });
    const onFire = vi.fn();
    provider.scheduleDaily([{ slotId: 's1', slotName: '朝', notifyAt: '09:00' }], onFire);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(onFire).not.toHaveBeenCalled();
  });

  it('cancelAll: 予約済みタイマーを全て解除する', () => {
    const provider = new WebNotificationProvider({ now: fixedNow(8, 0) });
    const onFire = vi.fn();
    provider.scheduleDaily([{ slotId: 's1', slotName: '朝', notifyAt: '09:00' }], onFire);
    provider.cancelAll();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(onFire).not.toHaveBeenCalled();
  });

  it('scheduleDaily を 2 回呼ぶと前回の予約は自動で cancel される', () => {
    const provider = new WebNotificationProvider({ now: fixedNow(8, 0) });
    const onFire1 = vi.fn();
    const onFire2 = vi.fn();
    provider.scheduleDaily([{ slotId: 's1', slotName: '朝', notifyAt: '09:00' }], onFire1);
    provider.scheduleDaily([{ slotId: 's2', slotName: '夜', notifyAt: '21:00' }], onFire2);
    vi.advanceTimersByTime(60 * 60 * 1000); // 09:00
    expect(onFire1).not.toHaveBeenCalled();
    vi.advanceTimersByTime(12 * 60 * 60 * 1000); // 21:00
    expect(onFire2).toHaveBeenCalledTimes(1);
  });

  it('show: permission=granted のとき new Notification(title, {body}) を発火', () => {
    NotificationMock.permission = 'granted';
    const provider = new WebNotificationProvider({ now: fixedNow(9, 0) });
    provider.show('朝のタスク', '3 件未完了');
    expect(instances).toEqual([{ title: '朝のタスク', body: '3 件未完了' }]);
  });

  it('show: permission!=granted のときは Notification を作らない', () => {
    NotificationMock.permission = 'denied';
    const provider = new WebNotificationProvider({ now: fixedNow(9, 0) });
    provider.show('朝のタスク');
    expect(instances).toEqual([]);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm nx test @org/habit-sync -- --run src/notify/WebNotificationProvider.test.ts
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`packages/habit-sync/src/notify/WebNotificationProvider.ts`:

```ts
import type {
  NotificationProvider,
  PermissionState,
  SlotSchedule,
} from './NotificationProvider.js';

export interface WebNotificationProviderOptions {
  // テストで時計を制御するための DI。本番は () => new Date()
  now?: () => Date;
}

// "HH:MM" または "HH:MM:SS" を [hour, minute] に分解
function parseNotifyAt(notifyAt: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(notifyAt);
  if (m === null) {
    return null;
  }
  const hour = Number.parseInt(m[1], 10);
  const minute = Number.parseInt(m[2], 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  return { hour, minute };
}

// ブラウザ環境向けの NotificationProvider 実装（v1: フォアグラウンドのみ）。
// - requestPermission: Notification.requestPermission() を呼び 'default' を 'prompt' に正規化
// - scheduleDaily: 各 slot の notifyAt 時刻（今日のローカル時刻）まで setTimeout で予約
//   - 既に予約済みのタイマーがあれば自動で cancelAll してから再予約
//   - 過去時刻のスロットはスキップ（v1 は当日中のみ）
// - cancelAll: 全タイマー解除
// - show: permission=granted の場合のみ new Notification(...)
export class WebNotificationProvider implements NotificationProvider {
  private timerIds: number[] = [];
  private readonly now: () => Date;

  constructor(options: WebNotificationProviderOptions = {}) {
    this.now = options.now ?? ((): Date => new Date());
  }

  async requestPermission(): Promise<PermissionState> {
    if (typeof globalThis.Notification === 'undefined') {
      return 'denied';
    }
    const result = await globalThis.Notification.requestPermission();
    if (result === 'granted') {
      return 'granted';
    }
    if (result === 'denied') {
      return 'denied';
    }
    return 'prompt';
  }

  scheduleDaily(slots: SlotSchedule[], onFire: (slot: SlotSchedule) => void): void {
    this.cancelAll();
    const now = this.now();
    for (const slot of slots) {
      const parsed = parseNotifyAt(slot.notifyAt);
      if (parsed === null) {
        continue;
      }
      const target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        parsed.hour,
        parsed.minute,
        0,
        0,
      );
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        // 過去時刻はスキップ（v1 は当日中のみ）
        continue;
      }
      // setTimeout の戻り値は Node では NodeJS.Timeout、ブラウザでは number。
      // unknown 経由でキャストして number として保持する。
      const id = setTimeout(() => {
        onFire(slot);
      }, diff) as unknown as number;
      this.timerIds.push(id);
    }
  }

  cancelAll(): void {
    for (const id of this.timerIds) {
      clearTimeout(id);
    }
    this.timerIds = [];
  }

  show(title: string, body?: string): void {
    if (typeof globalThis.Notification === 'undefined') {
      return;
    }
    if (globalThis.Notification.permission !== 'granted') {
      return;
    }
    new globalThis.Notification(title, body !== undefined ? { body } : undefined);
  }
}
```

- [ ] **Step 4: index.ts に re-export を追加**

`packages/habit-sync/src/index.ts` の既存 `notify/NotificationProvider.js` の type 行直下に追加（Biome に従い alphabetical 配置）:

```ts
export type {
  NotificationProvider,
  PermissionState,
  SlotSchedule,
} from './notify/NotificationProvider.js';
export type { WebNotificationProviderOptions } from './notify/WebNotificationProvider.js';
export { WebNotificationProvider } from './notify/WebNotificationProvider.js';
```

- [ ] **Step 5: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm nx test @org/habit-sync -- --run src/notify/WebNotificationProvider.test.ts
```

Expected: PASS（9 件）

- [ ] **Step 6: 全体検証**

```bash
cd /Users/ikomiki/workspace/daily-task && CI=true pnpm nx test @org/habit-sync && pnpm exec biome ci packages/habit-sync/src/notify/WebNotificationProvider.ts packages/habit-sync/src/notify/WebNotificationProvider.test.ts packages/habit-sync/src/index.ts
```

Expected: 全 PASS、biome clean

- [ ] **Step 7: コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && git add packages/habit-sync/src/notify/WebNotificationProvider.ts packages/habit-sync/src/notify/WebNotificationProvider.test.ts packages/habit-sync/src/index.ts && git commit -m "feat(habit-sync): add WebNotificationProvider with setTimeout-based scheduling"
```

---

## Task 3: getSlotPendingNotificationTasks 純粋関数

**Files:**
- Create: `apps/habits/src/lib/slot-pending.ts`
- Test: `apps/habits/src/lib/slot-pending.test.ts`

特定スロットの「当日の未操作（status=empty）タスク」を抽出する純粋関数。`@org/habit-sync` の `getTodayTasksView` を再利用して slot で filter → `status === 'empty'` で filter。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/lib/slot-pending.test.ts`:

```ts
import type { Task, TaskLog, TimeSlot } from '@org/habit-sync';
import { describe, expect, it } from 'vitest';
import { getSlotPendingNotificationTasks } from './slot-pending.js';

const NOW = '2026-05-16T00:00:00Z';

function mkTask(over: Partial<Task> & { id: string }): Task {
  return {
    id: over.id,
    user_id: 'u',
    time_slot_id: 's1',
    name: over.name ?? `task-${over.id}`,
    frequency: { type: 'daily' },
    sort_order: 0,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}
function mkSlot(over: Partial<TimeSlot> & { id: string }): TimeSlot {
  return {
    id: over.id,
    user_id: 'u',
    name: over.name ?? 'slot',
    notify_at: '09:00:00',
    sort_order: 0,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}
function mkLog(taskId: string, date: string, status: 'complete' | 'skip' | 'fail'): TaskLog {
  return { task_id: taskId, date, status, created_at: NOW, updated_at: NOW };
}

describe('getSlotPendingNotificationTasks', () => {
  it('スロットが存在しない場合は空配列', () => {
    expect(getSlotPendingNotificationTasks('missing', '2026-05-16', [], [], [])).toEqual([]);
  });

  it('指定スロットの未操作タスクだけを返す', () => {
    const slots = [mkSlot({ id: 's1' })];
    const tasks = [
      mkTask({ id: 't1', time_slot_id: 's1', name: 'A' }),
      mkTask({ id: 't2', time_slot_id: 's1', name: 'B' }),
    ];
    const result = getSlotPendingNotificationTasks('s1', '2026-05-16', tasks, [], slots);
    expect(result.map((t) => t.name).sort()).toEqual(['A', 'B']);
  });

  it('既に complete/skip/fail のタスクは除外', () => {
    const slots = [mkSlot({ id: 's1' })];
    const tasks = [
      mkTask({ id: 't1', time_slot_id: 's1', name: 'A' }),
      mkTask({ id: 't2', time_slot_id: 's1', name: 'B' }),
      mkTask({ id: 't3', time_slot_id: 's1', name: 'C' }),
    ];
    const logs = [
      mkLog('t1', '2026-05-16', 'complete'),
      mkLog('t2', '2026-05-16', 'skip'),
    ];
    const result = getSlotPendingNotificationTasks('s1', '2026-05-16', tasks, logs, slots);
    expect(result.map((t) => t.name)).toEqual(['C']);
  });

  it('他スロットのタスクは含まない', () => {
    const slots = [mkSlot({ id: 's1' }), mkSlot({ id: 's2' })];
    const tasks = [
      mkTask({ id: 't1', time_slot_id: 's1', name: 'A' }),
      mkTask({ id: 't2', time_slot_id: 's2', name: 'B' }),
    ];
    const result = getSlotPendingNotificationTasks('s1', '2026-05-16', tasks, [], slots);
    expect(result.map((t) => t.name)).toEqual(['A']);
  });

  it('archived タスクは除外', () => {
    const slots = [mkSlot({ id: 's1' })];
    const tasks = [
      mkTask({ id: 't1', time_slot_id: 's1', name: 'A' }),
      mkTask({ id: 't2', time_slot_id: 's1', name: 'B', archived_at: '2026-05-15T00:00:00Z' }),
    ];
    const result = getSlotPendingNotificationTasks('s1', '2026-05-16', tasks, [], slots);
    expect(result.map((t) => t.name)).toEqual(['A']);
  });

  it('頻度に合わない (every_n_days=2, anchor 違い) タスクは除外', () => {
    const slots = [mkSlot({ id: 's1' })];
    const tasks = [
      mkTask({
        id: 't1',
        time_slot_id: 's1',
        name: 'A',
        frequency: { type: 'every_n_days', n: 2, anchor: '2026-05-15' },
      }),
    ];
    // anchor=2026-05-15 + every 2 days → 5/15, 5/17 がマッチ。5/16 はマッチしない
    const result = getSlotPendingNotificationTasks('s1', '2026-05-16', tasks, [], slots);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/lib/slot-pending.test.ts
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`apps/habits/src/lib/slot-pending.ts`:

```ts
import { getTodayTasksView, type Task, type TaskLog, type TimeSlot } from '@org/habit-sync';

// 指定スロットで「今日」発火すべき未操作タスクを抽出する。
// 既存の getTodayTasksView を再利用して、time_slot_id 一致 + status='empty' で絞る。
// archived や頻度マッチ判定は getTodayTasksView が内部で実施済み。
export function getSlotPendingNotificationTasks(
  slotId: string,
  today: string,
  tasks: Task[],
  taskLogs: TaskLog[],
  timeSlots: TimeSlot[],
): Task[] {
  const groups = getTodayTasksView(tasks, taskLogs, timeSlots, today);
  const group = groups.find((g) => g.time_slot_id === slotId);
  if (group === undefined) {
    return [];
  }
  // getTodayTasksView の戻り値 TodayTaskItem には Task 全体は含まれないので、
  // 元の tasks 配列から id で引き直す（archived/frequency フィルタは通過済み）
  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  const pendingItems = group.tasks.filter((it) => it.status === 'empty');
  const result: Task[] = [];
  for (const it of pendingItems) {
    const task = taskById.get(it.id);
    if (task !== undefined) {
      result.push(task);
    }
  }
  return result;
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/lib/slot-pending.test.ts
```

Expected: PASS（6 件）

- [ ] **Step 5: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/lib/slot-pending.ts apps/habits/src/lib/slot-pending.test.ts && git add apps/habits/src/lib/slot-pending.ts apps/habits/src/lib/slot-pending.test.ts && git commit -m "feat(habits): add getSlotPendingNotificationTasks pure util"
```

---

## Task 4: useNotificationPermission フック

**Files:**
- Create: `apps/habits/src/hooks/useNotificationPermission.ts`
- Test: `apps/habits/src/hooks/useNotificationPermission.test.tsx`

`Notification.permission` を React state として購読し、`requestPermission()` の wrapper を返す。

戻り値:
```ts
interface UseNotificationPermissionResult {
  permission: 'granted' | 'denied' | 'prompt' | 'unsupported';
  request: () => Promise<void>;
}
```

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/hooks/useNotificationPermission.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class NotifMock {
  static permission: 'granted' | 'denied' | 'default' = 'default';
  static requestPermissionMock = vi.fn();
  static requestPermission(): Promise<'granted' | 'denied' | 'default'> {
    return NotifMock.requestPermissionMock();
  }
}

beforeEach(() => {
  NotifMock.permission = 'default';
  NotifMock.requestPermissionMock.mockReset();
  // biome-ignore lint/suspicious/noExplicitAny: テスト用グローバル差し替え
  (globalThis as any).Notification = NotifMock;
});
afterEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: テスト用グローバル復元
  delete (globalThis as any).Notification;
});

import { useNotificationPermission } from './useNotificationPermission.js';

function Probe(): React.ReactElement {
  const { permission, request } = useNotificationPermission();
  return (
    <div>
      <span data-testid="perm">{permission}</span>
      <button
        type="button"
        onClick={() => {
          void request();
        }}
      >
        request
      </button>
    </div>
  );
}

describe('useNotificationPermission', () => {
  it('初期 permission=default のとき "prompt"', () => {
    render(<Probe />);
    expect(screen.getByTestId('perm')).toHaveTextContent('prompt');
  });

  it('Notification API 未対応では "unsupported"', () => {
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    delete (globalThis as any).Notification;
    render(<Probe />);
    expect(screen.getByTestId('perm')).toHaveTextContent('unsupported');
  });

  it('request() 後に granted へ遷移', async () => {
    NotifMock.requestPermissionMock.mockImplementation(async () => {
      NotifMock.permission = 'granted';
      return 'granted';
    });
    render(<Probe />);
    await act(async () => {
      screen.getByRole('button', { name: 'request' }).click();
    });
    expect(screen.getByTestId('perm')).toHaveTextContent('granted');
  });

  it('request() 後 denied のとき "denied"', async () => {
    NotifMock.requestPermissionMock.mockImplementation(async () => {
      NotifMock.permission = 'denied';
      return 'denied';
    });
    render(<Probe />);
    await act(async () => {
      screen.getByRole('button', { name: 'request' }).click();
    });
    expect(screen.getByTestId('perm')).toHaveTextContent('denied');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/hooks/useNotificationPermission.test.tsx
```

Expected: FAIL

- [ ] **Step 3: 実装**

`apps/habits/src/hooks/useNotificationPermission.ts`:

```ts
import { useCallback, useState } from 'react';

export type DisplayPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface UseNotificationPermissionResult {
  permission: DisplayPermission;
  request: () => Promise<void>;
}

function readPermission(): DisplayPermission {
  if (typeof globalThis.Notification === 'undefined') {
    return 'unsupported';
  }
  const p = globalThis.Notification.permission;
  if (p === 'granted') {
    return 'granted';
  }
  if (p === 'denied') {
    return 'denied';
  }
  return 'prompt';
}

// Notification.permission を React state として購読する。
// 'default' は UI 表示用に 'prompt' に正規化、未対応環境は 'unsupported'。
// permission は Notification.requestPermission() 経由でしか変わらないため、
// request() 呼び出し時に setState で同期する。
export function useNotificationPermission(): UseNotificationPermissionResult {
  const [permission, setPermission] = useState<DisplayPermission>(() => readPermission());

  const request = useCallback(async (): Promise<void> => {
    if (typeof globalThis.Notification === 'undefined') {
      setPermission('unsupported');
      return;
    }
    await globalThis.Notification.requestPermission();
    setPermission(readPermission());
  }, []);

  return { permission, request };
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/hooks/useNotificationPermission.test.tsx
```

Expected: PASS（4 件）

- [ ] **Step 5: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/hooks/useNotificationPermission.ts apps/habits/src/hooks/useNotificationPermission.test.tsx && git add apps/habits/src/hooks/useNotificationPermission.ts apps/habits/src/hooks/useNotificationPermission.test.tsx && git commit -m "feat(habits): add useNotificationPermission hook"
```

---

## Task 5: NotificationManager コンポーネント

**Files:**
- Create: `apps/habits/src/features/notify/NotificationManager.tsx`
- Test: `apps/habits/src/features/notify/NotificationManager.test.tsx`

UI を持たず、`state$.time_slots` を購読して provider.scheduleDaily を呼び、onFire で `getSlotPendingNotificationTasks` を実行して通知を発火する orchestrator。

設計:
- props: `provider: NotificationProvider`, `today: string`
- `state$.time_slots` の変化に応じて `provider.scheduleDaily(slots, onFire)` を再実行
- onFire: state$.tasks / state$.task_logs / state$.time_slots を `.peek()` 同等で読み、`getSlotPendingNotificationTasks` で抽出、件数 > 0 で `provider.show(slot.name, "X 件未完了")`
- unmount で `provider.cancelAll()`

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/features/notify/NotificationManager.test.tsx`:

```tsx
import { state$, type NotificationProvider, type Task, type TimeSlot } from '@org/habit-sync';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationManager } from './NotificationManager.js';

const NOW = '2026-05-16T00:00:00Z';
const TODAY = '2026-05-16';

function mkSlot(over: Partial<TimeSlot> & { id: string }): TimeSlot {
  return {
    id: over.id,
    user_id: 'u',
    name: over.name ?? 'slot',
    notify_at: '09:00:00',
    sort_order: 0,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}
function mkTask(over: Partial<Task> & { id: string }): Task {
  return {
    id: over.id,
    user_id: 'u',
    time_slot_id: 's1',
    name: over.name ?? `t-${over.id}`,
    frequency: { type: 'daily' },
    sort_order: 0,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}

function makeProvider(): NotificationProvider & {
  scheduleCalls: { slots: unknown; onFire: (s: { slotId: string }) => void }[];
  cancelCalls: number;
  shownCalls: { title: string; body?: string }[];
} {
  const scheduleCalls: { slots: unknown; onFire: (s: { slotId: string }) => void }[] = [];
  const shownCalls: { title: string; body?: string }[] = [];
  let cancelCalls = 0;
  return {
    scheduleCalls,
    shownCalls,
    get cancelCalls() {
      return cancelCalls;
    },
    requestPermission: async () => 'granted',
    scheduleDaily(slots, onFire) {
      // biome-ignore lint/suspicious/noExplicitAny: テスト用
      scheduleCalls.push({ slots, onFire: onFire as any });
    },
    cancelAll() {
      cancelCalls += 1;
    },
    show(title, body) {
      shownCalls.push({ title, body });
    },
  } as ReturnType<typeof makeProvider>;
}

beforeEach(() => {
  state$.tasks.set({});
  state$.task_logs.set({});
  state$.time_slots.set({});
});
afterEach(() => {
  state$.tasks.set({});
  state$.task_logs.set({});
  state$.time_slots.set({});
});

describe('NotificationManager', () => {
  it('マウント時に provider.scheduleDaily を呼ぶ', () => {
    state$.time_slots.assign({ s1: mkSlot({ id: 's1' }) });
    const provider = makeProvider();
    render(<NotificationManager provider={provider} today={TODAY} />);
    expect(provider.scheduleCalls).toHaveLength(1);
    expect(provider.scheduleCalls[0].slots).toEqual([
      { slotId: 's1', slotName: 'slot', notifyAt: '09:00:00' },
    ]);
  });

  it('time_slots 変化で reschedule（cancelAll が呼ばれる）', () => {
    state$.time_slots.assign({ s1: mkSlot({ id: 's1' }) });
    const provider = makeProvider();
    render(<NotificationManager provider={provider} today={TODAY} />);
    const initialSchedules = provider.scheduleCalls.length;
    state$.time_slots.assign({ s1: mkSlot({ id: 's1' }), s2: mkSlot({ id: 's2', name: '夜' }) });
    expect(provider.scheduleCalls.length).toBeGreaterThan(initialSchedules);
  });

  it('unmount で cancelAll を呼ぶ', () => {
    state$.time_slots.assign({ s1: mkSlot({ id: 's1' }) });
    const provider = makeProvider();
    const { unmount } = render(<NotificationManager provider={provider} today={TODAY} />);
    const before = provider.cancelCalls;
    unmount();
    expect(provider.cancelCalls).toBeGreaterThan(before);
  });

  it('onFire で未操作タスクが 1 件以上なら show を呼ぶ', () => {
    state$.time_slots.assign({ s1: mkSlot({ id: 's1', name: '朝' }) });
    state$.tasks.assign({
      t1: mkTask({ id: 't1', time_slot_id: 's1', name: 'A' }),
      t2: mkTask({ id: 't2', time_slot_id: 's1', name: 'B' }),
    });
    const provider = makeProvider();
    render(<NotificationManager provider={provider} today={TODAY} />);
    const onFire = provider.scheduleCalls[0].onFire;
    onFire({ slotId: 's1', slotName: '朝', notifyAt: '09:00:00' } as unknown as never);
    expect(provider.shownCalls).toHaveLength(1);
    expect(provider.shownCalls[0].title).toBe('朝');
    expect(provider.shownCalls[0].body).toMatch(/2 件/);
  });

  it('onFire で未操作タスクが 0 件なら show を呼ばない', () => {
    state$.time_slots.assign({ s1: mkSlot({ id: 's1' }) });
    state$.tasks.assign({
      t1: mkTask({ id: 't1', time_slot_id: 's1' }),
    });
    state$.task_logs.assign({
      't1-2026-05-16': {
        task_id: 't1',
        date: '2026-05-16',
        status: 'complete',
        created_at: NOW,
        updated_at: NOW,
      },
    });
    const provider = makeProvider();
    render(<NotificationManager provider={provider} today={TODAY} />);
    const onFire = provider.scheduleCalls[0].onFire;
    onFire({ slotId: 's1', slotName: 'slot', notifyAt: '09:00:00' } as unknown as never);
    expect(provider.shownCalls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/features/notify/NotificationManager.test.tsx
```

Expected: FAIL

- [ ] **Step 3: 実装**

`apps/habits/src/features/notify/NotificationManager.tsx`:

```tsx
import { use$ } from '@legendapp/state/react';
import {
  type NotificationProvider,
  type SlotSchedule,
  state$,
  type Task,
  type TaskLog,
  type TimeSlot,
} from '@org/habit-sync';
import { useEffect } from 'react';
import { getSlotPendingNotificationTasks } from '../../lib/slot-pending.js';

export interface NotificationManagerProps {
  provider: NotificationProvider;
  today: string; // YYYY-MM-DD
}

// UI を持たない orchestrator。
// state$.time_slots を購読して、変化のたびに provider.scheduleDaily を再実行する。
// onFire(slot) のタイミングで state$.tasks / state$.task_logs から未操作タスクを抽出し、
// 件数 > 0 のとき provider.show(slot.name, body) で通知を発火する。
export function NotificationManager(props: NotificationManagerProps): null {
  const { provider, today } = props;

  // time_slots の id/notify_at/name/sort_order が変わったら effect を再走させたいので、
  // 比較可能な signature を作って依存配列に渡す。
  const slotsSignature = use$<string>(() => {
    const slots = (Object.values(state$.time_slots.get()) as TimeSlot[])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    return slots.map((s) => `${s.id}|${s.name}|${s.notify_at}`).join(',');
  });

  useEffect(() => {
    const slots = (Object.values(state$.time_slots.get()) as TimeSlot[])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const schedules: SlotSchedule[] = slots.map((s) => ({
      slotId: s.id,
      slotName: s.name,
      notifyAt: s.notify_at,
    }));
    provider.scheduleDaily(schedules, (slot) => {
      const tasks = Object.values(state$.tasks.get()) as Task[];
      const logs = Object.values(state$.task_logs.get()) as TaskLog[];
      const allSlots = Object.values(state$.time_slots.get()) as TimeSlot[];
      const pending = getSlotPendingNotificationTasks(slot.slotId, today, tasks, logs, allSlots);
      if (pending.length === 0) {
        return;
      }
      provider.show(slot.slotName, `${pending.length} 件のタスクが未完了です`);
    });
    return () => {
      provider.cancelAll();
    };
    // slotsSignature を依存に入れることで、time_slots 内容が変わったときに effect が再走する
  }, [provider, today, slotsSignature]);

  return null;
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/features/notify/NotificationManager.test.tsx
```

Expected: PASS（5 件）

- [ ] **Step 5: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/features/notify/NotificationManager.tsx apps/habits/src/features/notify/NotificationManager.test.tsx && git add apps/habits/src/features/notify/NotificationManager.tsx apps/habits/src/features/notify/NotificationManager.test.tsx && git commit -m "feat(habits): add NotificationManager orchestrator"
```

---

## Task 6: SettingsNotificationsPage

**Files:**
- Create: `apps/habits/src/routes/settings/SettingsNotificationsPage.tsx`
- Test: `apps/habits/src/routes/settings/SettingsNotificationsPage.test.tsx`

権限の現在値表示と「通知を許可する」ボタンを持つ設定画面。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/routes/settings/SettingsNotificationsPage.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}));

class NotifMock {
  static permission: 'granted' | 'denied' | 'default' = 'default';
  static requestPermissionMock = vi.fn();
  static requestPermission(): Promise<'granted' | 'denied' | 'default'> {
    return NotifMock.requestPermissionMock();
  }
}

beforeEach(() => {
  NotifMock.permission = 'default';
  NotifMock.requestPermissionMock.mockReset();
  // biome-ignore lint/suspicious/noExplicitAny: テスト用
  (globalThis as any).Notification = NotifMock;
});
afterEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: テスト用
  delete (globalThis as any).Notification;
});

import { SettingsNotificationsPage } from './SettingsNotificationsPage.js';

describe('SettingsNotificationsPage', () => {
  it('「通知設定」見出しを表示', () => {
    render(<SettingsNotificationsPage />);
    expect(screen.getByRole('heading', { name: '通知設定' })).toBeInTheDocument();
  });

  it('初期 permission=default のとき「未許可」と表示し、許可ボタンを出す', () => {
    render(<SettingsNotificationsPage />);
    expect(screen.getByText(/未許可/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通知を許可する' })).toBeInTheDocument();
  });

  it('permission=granted のとき「許可済み」表示で許可ボタンは非表示', () => {
    NotifMock.permission = 'granted';
    render(<SettingsNotificationsPage />);
    expect(screen.getByText(/許可済み/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '通知を許可する' })).not.toBeInTheDocument();
  });

  it('permission=denied のとき「拒否」表示で許可ボタンは非表示', () => {
    NotifMock.permission = 'denied';
    render(<SettingsNotificationsPage />);
    expect(screen.getByText(/拒否/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '通知を許可する' })).not.toBeInTheDocument();
  });

  it('ボタンクリックで requestPermission が呼ばれ、許可後は「許可済み」表示に切替', async () => {
    NotifMock.requestPermissionMock.mockImplementation(async () => {
      NotifMock.permission = 'granted';
      return 'granted';
    });
    render(<SettingsNotificationsPage />);
    fireEvent.click(screen.getByRole('button', { name: '通知を許可する' }));
    await waitFor(() => {
      expect(screen.getByText(/許可済み/)).toBeInTheDocument();
    });
  });

  it('Notification API 未対応では「お使いのブラウザは通知非対応」と表示', () => {
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    delete (globalThis as any).Notification;
    render(<SettingsNotificationsPage />);
    expect(screen.getByText(/通知非対応/)).toBeInTheDocument();
  });

  it('時間帯設定 / 今日のタスクへ戻るリンクを表示する', () => {
    render(<SettingsNotificationsPage />);
    expect(screen.getByRole('link', { name: '時間帯' })).toHaveAttribute(
      'href',
      '/settings/time-slots',
    );
    expect(screen.getByRole('link', { name: '今日のタスク' })).toHaveAttribute('href', '/today');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/routes/settings/SettingsNotificationsPage.test.tsx
```

Expected: FAIL

- [ ] **Step 3: 実装**

`apps/habits/src/routes/settings/SettingsNotificationsPage.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import type React from 'react';
import { useNotificationPermission } from '../../hooks/useNotificationPermission.js';

function permissionLabel(p: 'granted' | 'denied' | 'prompt' | 'unsupported'): string {
  switch (p) {
    case 'granted':
      return '許可済み';
    case 'denied':
      return '拒否';
    case 'prompt':
      return '未許可';
    case 'unsupported':
      return 'お使いのブラウザは通知非対応';
  }
}

export function SettingsNotificationsPage(): React.ReactElement {
  const { permission, request } = useNotificationPermission();
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-game-accent">通知設定</h1>
        <nav className="flex items-center gap-2">
          <Link
            to="/settings/time-slots"
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            時間帯
          </Link>
          <Link to="/today" className="rounded border border-gray-500 px-3 py-1 text-sm">
            今日のタスク
          </Link>
        </nav>
      </header>
      <div className="space-y-3">
        <p className="text-sm">
          現在のステータス: <span className="font-mono">{permissionLabel(permission)}</span>
        </p>
        {permission === 'prompt' ? (
          <button
            type="button"
            onClick={() => {
              void request();
            }}
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            通知を許可する
          </button>
        ) : null}
        <p className="text-xs text-gray-500">
          v1 はアプリを開いている間のみ通知します（フォアグラウンド通知）。
          スロット時刻に「未完了タスクが残っている」場合のみ発火します。
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/routes/settings/SettingsNotificationsPage.test.tsx
```

Expected: PASS（7 件）

- [ ] **Step 5: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/routes/settings/SettingsNotificationsPage.tsx apps/habits/src/routes/settings/SettingsNotificationsPage.test.tsx && git add apps/habits/src/routes/settings/SettingsNotificationsPage.tsx apps/habits/src/routes/settings/SettingsNotificationsPage.test.tsx && git commit -m "feat(habits): add SettingsNotificationsPage with permission UI"
```

---

## Task 7: router.tsx に /settings/notifications を追加 + NotificationManager 配置

**Files:**
- Modify: `apps/habits/src/router.tsx`
- Modify: `apps/habits/src/App.test.tsx`

`requireAuth` 付きで `/settings/notifications` を追加し、rootRoute の component で NotificationManager を Outlet と一緒に mount する（認証ガード後にしか権限を要求しないので、安全に常時マウント可能）。

- [ ] **Step 1: App.test.tsx に失敗するテストを追加**

`apps/habits/src/App.test.tsx` の `/history` テスト直後に挿入:

```tsx
  it('認証済みで /settings/notifications にアクセスすると「通知設定」ページが表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/settings/notifications');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '通知設定' })).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/App.test.tsx
```

Expected: 1 件 FAIL

- [ ] **Step 3: router.tsx を更新**

`apps/habits/src/router.tsx` の import 群に追加:

```ts
import { WebNotificationProvider } from '@org/habit-sync';
import { NotificationManager } from './features/notify/NotificationManager.js';
import { getTodayDateString } from './lib/today-date.js';
import { SettingsNotificationsPage } from './routes/settings/SettingsNotificationsPage.js';
```

`rootRoute` の component を以下に更新（NotificationManager を Outlet と並列にマウント）:

```tsx
const notificationProvider = new WebNotificationProvider();

const rootRoute = createRootRoute({
  component: () => (
    <main className="min-h-screen">
      <NotificationManager provider={notificationProvider} today={getTodayDateString()} />
      <Outlet />
    </main>
  ),
});
```

`/settings/notifications` ルートを `historyRoute` の直後に追加:

```ts
const settingsNotificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/notifications',
  beforeLoad: requireAuth,
  component: SettingsNotificationsPage,
});
```

`routeTree` に `settingsNotificationsRoute` を追加（`historyRoute` の後）:

```ts
const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  tasksRoute,
  taskNewRoute,
  taskEditRoute,
  settingsTimeSlotsRoute,
  settingsNotificationsRoute,
  stashRoute,
  historyRoute,
  authLoginRoute,
  authSignupRoute,
]);
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/App.test.tsx
```

Expected: PASS（11 件）

- [ ] **Step 5: 全 habits テストで regress 確認**

```bash
cd /Users/ikomiki/workspace/daily-task && CI=true pnpm nx test habits
```

Expected: PASS

- [ ] **Step 6: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/router.tsx apps/habits/src/App.test.tsx && git add apps/habits/src/router.tsx apps/habits/src/App.test.tsx && git commit -m "feat(habits): wire /settings/notifications and mount NotificationManager"
```

---

## Task 8: SettingsTimeSlotsPage に通知設定への cross-link を追加

**Files:**
- Modify: `apps/habits/src/routes/settings/SettingsTimeSlotsPage.tsx`
- Modify: `apps/habits/src/routes/settings/SettingsTimeSlotsPage.test.tsx`

時間帯設定ページから通知設定へ遷移できるようにする。

- [ ] **Step 1: SettingsTimeSlotsPage.test.tsx に失敗するテストを追加**

既存の `describe('SettingsTimeSlotsPage', ...)` 末尾に追加（`describe` の閉じ括弧の直前）:

```tsx
  it('通知設定リンクが表示される', () => {
    render(<SettingsTimeSlotsPage />);
    const link = screen.getByRole('link', { name: '通知設定' });
    expect(link).toHaveAttribute('href', '/settings/notifications');
  });
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/routes/settings/SettingsTimeSlotsPage.test.tsx
```

Expected: 1 件 FAIL

- [ ] **Step 3: SettingsTimeSlotsPage.tsx を更新**

ヘッダー nav に「通知設定」リンクを追加（既存リンクの近くに配置）。具体的な配置箇所は既存実装を読んで決定。例:

```tsx
<Link to="/settings/notifications" className="rounded border border-gray-500 px-3 py-1 text-sm">
  通知設定
</Link>
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/routes/settings/SettingsTimeSlotsPage.test.tsx
```

Expected: PASS（既存 + 新規 1 件）

- [ ] **Step 5: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/routes/settings/SettingsTimeSlotsPage.tsx apps/habits/src/routes/settings/SettingsTimeSlotsPage.test.tsx && git add apps/habits/src/routes/settings/SettingsTimeSlotsPage.tsx apps/habits/src/routes/settings/SettingsTimeSlotsPage.test.tsx && git commit -m "feat(habits): cross-link to notifications from time-slots settings"
```

---

## Task 9: CLAUDE.md に M10 セクションを追加

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md を更新**

`### 履歴画面 / 過去ログ遅延取得（M9 以降）` セクション直後（`## E2E（Playwright）` 見出しの直前）に挿入:

```markdown
### 通知 v1 / フォアグラウンドスケジューラ（M10 以降）

- `/settings/notifications`: 権限の現在値表示 + 「通知を許可する」ボタン
- `packages/habit-sync/src/notify/WebNotificationProvider.ts` がブラウザ Notification API + setTimeout の v1 実装
- `apps/habits/src/features/notify/NotificationManager.tsx` が `state$.time_slots` を購読し、各 slot の `notify_at` 時刻に `setTimeout` を予約
- スロット時刻に発火すると `getSlotPendingNotificationTasks` で当日の未操作（status='empty'）タスクを抽出し、件数 > 0 のとき `provider.show(slot.name, "X 件未完了")` 通知
- `useNotificationPermission()` で `Notification.permission` を React state 化（'default' は 'prompt' に正規化、API 無しは 'unsupported'）
- `WebNotificationProvider` は `{ now: () => Date }` で時計を DI 可能（fake timers テスト用）
- スコープ外: 日跨ぎ自動再スケジュール（v1 は当日中のみ）、Service Worker / Web Push、タスク単位通知
```

- [ ] **Step 2: コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && git add CLAUDE.md && git commit -m "docs: document M10 notification v1 section in CLAUDE.md"
```

---

## 完了検証

すべてのタスク完了後の最終チェック:

- [ ] **typecheck / test 全件**

```bash
cd /Users/ikomiki/workspace/daily-task
CI=true pnpm nx run-many -t typecheck test --skip-nx-cache
```

Expected: 全 5 プロジェクト緑

- [ ] **biome ci**

```bash
pnpm exec biome ci .
```

Expected: clean

- [ ] **手動確認（任意、Supabase 起動済の場合）**

```bash
supabase start
pnpm nx serve habits
```

ブラウザで:

1. `/today` → 「設定」 → `/settings/time-slots` → 「通知設定」 → `/settings/notifications`
2. 「通知を許可する」ボタンクリック → ブラウザの権限ダイアログ → 許可
3. 「許可済み」表示に切替、ボタン非表示
4. 時間帯の `notify_at` を直近の数分後に編集 → その時刻にデスクトップ通知が発火（slot.name + "X 件未完了"）
5. 該当時間帯のタスクを全部 complete にしてから時刻を待つ → 通知発火しない
6. DevTools Application タブで Notification.permission が "granted" 確認

---

## スコープ外（将来拡張）

- **日跨ぎ自動再スケジュール**: v1.5 で `setInterval` ベースのリスケや 0:00 トリガーで対応予定
- **Service Worker / Web Push**: タブを閉じても通知を出すため、Supabase Edge Function + pg_cron + Web Push API 連携
- **タスク単位の通知**: 現在は slot 単位サマリ（「X 件未完了」）。将来は個別タスク名・優先度別
- **Tauri ネイティブ通知**: `TauriNotificationProvider` 実装、`tauri-plugin-notification` 使用
- **通知音 / バイブレーション / アクション**: Notification API のオプション活用
- **タイムゾーン / DST 移行時の振る舞い**: v1 はブラウザのローカル時間任せ、跨ぎ際は再起動で解消
