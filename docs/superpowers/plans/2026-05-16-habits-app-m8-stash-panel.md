# Habits App M8: StashPanel + PendingSyncBadge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タスクごとの集計（完了数 / スキップ数 / 失敗数 / streak / task_days / 完了率 / 最終完了日）を一覧表示する `/stash` ルートと、オフライン・未同期件数を可視化する `PendingSyncBadge` を実装する。

**Architecture:** `state$.task_stash_view`（M5 で接続済の VIEW 同期）と `state$.tasks` を結合する React hook を新設し、`features/stash/` 配下に表示コンポーネントを構築する。`getPendingSyncCount(state$)` と `online$`（既存）を React hook 化して `PendingSyncBadge` から購読する。Today 画面ヘッダーから `/stash` へのリンクを追加する。

**Tech Stack:** React 19, legend-state v3 beta, `@legendapp/state/react` の `use$`, TanStack Router, Tailwind v4, Vitest + Testing Library

---

## ファイル構成

新規作成:

| パス | 責務 |
|---|---|
| `apps/habits/src/hooks/useOnlineStatus.ts` | `online$` を React で購読 |
| `apps/habits/src/hooks/usePendingSyncCount.ts` | `getPendingSyncCount(state$)` を React で reactive に購読 |
| `apps/habits/src/hooks/useTaskStashList.ts` | `state$.task_stash_view` + `state$.tasks` を結合してアクティブタスクのみ ソート済み一覧で返す |
| `apps/habits/src/lib/stash-format.ts` | 完了率パーセント表示・null セーフ整数表示の純粋関数 |
| `apps/habits/src/features/stash/PendingSyncBadge.tsx` | オフライン or 未同期 1 件以上のとき表示 |
| `apps/habits/src/features/stash/StashRow.tsx` | 1 タスクの集計 1 行表示 |
| `apps/habits/src/features/stash/StashPanel.tsx` | PendingSyncBadge + 全タスクの StashRow 一覧 |
| `apps/habits/src/routes/stash/StashPage.tsx` | `/stash` ルートのページ（ヘッダー + 戻るリンク + StashPanel） |

修正:

| パス | 修正内容 |
|---|---|
| `apps/habits/src/router.tsx` | `/stash` ルートを `requireAuth` 付きで追加 |
| `apps/habits/src/features/today/Today.tsx` | nav に「スタッシュ」リンクを追加 |
| `apps/habits/src/features/today/Today.test.tsx` | スタッシュリンクの表示テストを追加 |
| `apps/habits/src/App.test.tsx` | `/stash` ルーティングテストを 1 件追加 |
| `CLAUDE.md` | M8 以降のセクションを追加 |

データ流れ:

```
state$.task_stash_view ─┐
                         ├─→ useTaskStashList(activeOnly=true) ─→ StashRow[]
state$.tasks ────────────┘                                            ↓
                                                                  StashPanel
state$.* (sync queues) ─→ getPendingSyncCount ─→ usePendingSyncCount ─┘
online$ ─→ useOnlineStatus ─→ PendingSyncBadge
```

`task_stash_view` は LEFT JOIN ベースの VIEW のため、各数値カラムは `number | null` 型。`null` は「まだ集計対象の行が無い（= 0 件）」を意味するため UI 側で 0 に正規化する。`completion_rate` は分母 0 のとき `null`、その場合は「—」表示。

---

## Task 1: stash-format ユーティリティ（純粋関数）

**Files:**
- Create: `apps/habits/src/lib/stash-format.ts`
- Test: `apps/habits/src/lib/stash-format.test.ts`

null セーフな整数 / パーセント / 日付フォーマッタ。UI から呼び出す純粋関数として独立させ、テストで網羅する。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/lib/stash-format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  formatCompletionRate,
  formatLastCompletedDate,
  formatStashCount,
} from './stash-format.js';

describe('formatStashCount', () => {
  it('number 値はそのまま文字列で返す', () => {
    expect(formatStashCount(0)).toBe('0');
    expect(formatStashCount(7)).toBe('7');
  });

  it('null は 0 として扱う', () => {
    expect(formatStashCount(null)).toBe('0');
  });
});

describe('formatCompletionRate', () => {
  it('0.0–1.0 の値を整数パーセントに変換する', () => {
    expect(formatCompletionRate(0)).toBe('0%');
    expect(formatCompletionRate(0.5)).toBe('50%');
    expect(formatCompletionRate(1)).toBe('100%');
  });

  it('小数は四捨五入する', () => {
    expect(formatCompletionRate(0.6234)).toBe('62%');
    expect(formatCompletionRate(0.6789)).toBe('68%');
  });

  it('null は「—」を返す（分母 0 を意味する）', () => {
    expect(formatCompletionRate(null)).toBe('—');
  });
});

describe('formatLastCompletedDate', () => {
  it('YYYY-MM-DD はそのまま返す', () => {
    expect(formatLastCompletedDate('2026-05-16')).toBe('2026-05-16');
  });

  it('null は「—」を返す', () => {
    expect(formatLastCompletedDate(null)).toBe('—');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd apps/habits && pnpm exec vitest run src/lib/stash-format.test.ts
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`apps/habits/src/lib/stash-format.ts`:

```ts
// task_stash_view の各カラムは number | null（LEFT JOIN）。UI 表示用フォーマッタ。

export function formatStashCount(value: number | null): string {
  return String(value ?? 0);
}

// completion_rate は 0.0–1.0 の比率。null は分母 0（task_days = 0）を意味する。
export function formatCompletionRate(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

export function formatLastCompletedDate(value: string | null): string {
  if (value === null) {
    return '—';
  }
  return value;
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd apps/habits && pnpm exec vitest run src/lib/stash-format.test.ts
```

Expected: PASS（8 件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/lib/stash-format.ts apps/habits/src/lib/stash-format.test.ts
git commit -m "feat(habits): add stash-format util for task_stash_view rendering"
```

---

## Task 2: useOnlineStatus フック

**Files:**
- Create: `apps/habits/src/hooks/useOnlineStatus.ts`
- Test: `apps/habits/src/hooks/useOnlineStatus.test.tsx`

`@org/habit-sync` の `online$` observable を React で reactive に購読する。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/hooks/useOnlineStatus.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus.js';

// online$ を直接操作してフックの再評価を確認
import { online$ } from '@org/habit-sync';

function Probe(): React.ReactElement {
  const online = useOnlineStatus();
  return <span data-testid="online">{online ? 'online' : 'offline'}</span>;
}

describe('useOnlineStatus', () => {
  beforeEach(() => {
    online$.set(true);
  });
  afterEach(() => {
    online$.set(true);
  });

  it('online$ の値を返す', () => {
    render(<Probe />);
    expect(screen.getByTestId('online')).toHaveTextContent('online');
  });

  it('online$ が false になると offline を返す', () => {
    render(<Probe />);
    act(() => {
      online$.set(false);
    });
    expect(screen.getByTestId('online')).toHaveTextContent('offline');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd apps/habits && pnpm exec vitest run src/hooks/useOnlineStatus.test.tsx
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`apps/habits/src/hooks/useOnlineStatus.ts`:

```ts
import { use$ } from '@legendapp/state/react';
import { online$ } from '@org/habit-sync';

// online$ を React コンポーネントから reactive に購読する。
// 値が変わると use$ により呼び出し元が再レンダリングされる。
export function useOnlineStatus(): boolean {
  return use$(online$);
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd apps/habits && pnpm exec vitest run src/hooks/useOnlineStatus.test.tsx
```

Expected: PASS（2 件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/hooks/useOnlineStatus.ts apps/habits/src/hooks/useOnlineStatus.test.tsx
git commit -m "feat(habits): add useOnlineStatus hook subscribing online\$"
```

---

## Task 3: usePendingSyncCount フック

**Files:**
- Create: `apps/habits/src/hooks/usePendingSyncCount.ts`
- Test: `apps/habits/src/hooks/usePendingSyncCount.test.tsx`

`getPendingSyncCount(state$)` を React で reactive に購読する。`state$.tasks` / `state$.time_slots` / `state$.task_logs` の変更を検知して再評価。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/hooks/usePendingSyncCount.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import { state$ } from '@org/habit-sync';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePendingSyncCount } from './usePendingSyncCount.js';

function Probe(): React.ReactElement {
  const count = usePendingSyncCount();
  return <span data-testid="count">{count}</span>;
}

describe('usePendingSyncCount', () => {
  beforeEach(() => {
    state$.tasks.set({});
    state$.time_slots.set({});
    state$.task_logs.set({});
  });
  afterEach(() => {
    state$.tasks.set({});
    state$.time_slots.set({});
    state$.task_logs.set({});
  });

  it('テスト環境（sync 未接続）では 0 を返す', () => {
    render(<Probe />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('state$.tasks の変更で再評価される', () => {
    render(<Probe />);
    act(() => {
      // 単に変更を発火させるだけ。pending は sync 未接続のため 0 のまま
      state$.tasks.assign({
        x: {
          id: 'x',
          user_id: 'u',
          time_slot_id: 't',
          name: 'n',
          frequency: { type: 'daily' },
          sort_order: 0,
          archived_at: null,
          created_at: '2026-05-16T00:00:00Z',
          updated_at: '2026-05-16T00:00:00Z',
        },
      });
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd apps/habits && pnpm exec vitest run src/hooks/usePendingSyncCount.test.tsx
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`apps/habits/src/hooks/usePendingSyncCount.ts`:

```ts
import { use$ } from '@legendapp/state/react';
import { getPendingSyncCount, state$ } from '@org/habit-sync';

// state$ 全体の pending な書き込み件数を購読する。
// state$ のいずれかが変わるたびに getPendingSyncCount() が再評価される。
export function usePendingSyncCount(): number {
  return use$(() => {
    // tasks / time_slots / task_logs の get を発火させて依存登録する
    state$.tasks.get();
    state$.time_slots.get();
    state$.task_logs.get();
    return getPendingSyncCount(state$);
  });
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd apps/habits && pnpm exec vitest run src/hooks/usePendingSyncCount.test.tsx
```

Expected: PASS（2 件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/hooks/usePendingSyncCount.ts apps/habits/src/hooks/usePendingSyncCount.test.tsx
git commit -m "feat(habits): add usePendingSyncCount hook reactive to state\$"
```

---

## Task 4: useTaskStashList フック

**Files:**
- Create: `apps/habits/src/hooks/useTaskStashList.ts`
- Test: `apps/habits/src/hooks/useTaskStashList.test.tsx`

`state$.task_stash_view` と `state$.tasks` / `state$.time_slots` を結合し、アーカイブ済み除外 + スロット sort_order → タスク sort_order でソートした表示用配列を返す。

戻り値の型:

```ts
interface TaskStashRow {
  task_id: string;
  task_name: string;
  slot_name: string;
  complete_count: number | null;
  fail_count: number | null;
  skip_count: number | null;
  current_streak: number | null;
  task_days: number | null;
  completion_rate: number | null;
  last_completed_date: string | null;
}
```

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/hooks/useTaskStashList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { state$ } from '@org/habit-sync';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTaskStashList } from './useTaskStashList.js';

function Probe(): React.ReactElement {
  const rows = useTaskStashList();
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.task_id} data-testid="row">
          {r.task_name}|{r.slot_name}|{r.complete_count ?? 0}|{r.current_streak ?? 0}
        </li>
      ))}
    </ul>
  );
}

const NOW = '2026-05-16T00:00:00Z';

beforeEach(() => {
  state$.tasks.set({});
  state$.time_slots.set({});
  state$.task_stash_view.set({});
});
afterEach(() => {
  state$.tasks.set({});
  state$.time_slots.set({});
  state$.task_stash_view.set({});
});

describe('useTaskStashList', () => {
  it('tasks / time_slots / stash_view が空のとき空配列', () => {
    render(<Probe />);
    expect(screen.queryAllByTestId('row')).toHaveLength(0);
  });

  it('アクティブタスクのみ返し、archived は除外', () => {
    state$.time_slots.assign({
      s1: {
        id: 's1',
        user_id: 'u',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.tasks.assign({
      a: {
        id: 'a',
        user_id: 'u',
        time_slot_id: 's1',
        name: 'Active',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
      b: {
        id: 'b',
        user_id: 'u',
        time_slot_id: 's1',
        name: 'Archived',
        frequency: { type: 'daily' },
        sort_order: 1,
        archived_at: '2026-05-15T00:00:00Z',
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.task_stash_view.assign({
      a: {
        task_id: 'a',
        user_id: 'u',
        complete_count: 3,
        fail_count: 0,
        skip_count: 1,
        current_streak: 2,
        task_days: 5,
        completion_rate: 0.6,
        last_completed_date: '2026-05-15',
        updated_at: NOW,
      },
      b: {
        task_id: 'b',
        user_id: 'u',
        complete_count: 1,
        fail_count: 0,
        skip_count: 0,
        current_streak: 0,
        task_days: 1,
        completion_rate: 1,
        last_completed_date: '2026-05-10',
        updated_at: NOW,
      },
    });
    render(<Probe />);
    const rows = screen.getAllByTestId('row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Active|朝|3|2');
  });

  it('スロット sort_order → タスク sort_order の順に並ぶ', () => {
    state$.time_slots.assign({
      s1: {
        id: 's1',
        user_id: 'u',
        name: '夜',
        notify_at: '21:00:00',
        sort_order: 1,
        created_at: NOW,
        updated_at: NOW,
      },
      s2: {
        id: 's2',
        user_id: 'u',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.tasks.assign({
      t1: {
        id: 't1',
        user_id: 'u',
        time_slot_id: 's1',
        name: '夜A',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
      t2: {
        id: 't2',
        user_id: 'u',
        time_slot_id: 's2',
        name: '朝B',
        frequency: { type: 'daily' },
        sort_order: 1,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
      t3: {
        id: 't3',
        user_id: 'u',
        time_slot_id: 's2',
        name: '朝A',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.task_stash_view.assign({
      t1: {
        task_id: 't1',
        user_id: 'u',
        complete_count: 0,
        fail_count: 0,
        skip_count: 0,
        current_streak: 0,
        task_days: 0,
        completion_rate: null,
        last_completed_date: null,
        updated_at: NOW,
      },
      t2: {
        task_id: 't2',
        user_id: 'u',
        complete_count: 0,
        fail_count: 0,
        skip_count: 0,
        current_streak: 0,
        task_days: 0,
        completion_rate: null,
        last_completed_date: null,
        updated_at: NOW,
      },
      t3: {
        task_id: 't3',
        user_id: 'u',
        complete_count: 0,
        fail_count: 0,
        skip_count: 0,
        current_streak: 0,
        task_days: 0,
        completion_rate: null,
        last_completed_date: null,
        updated_at: NOW,
      },
    });
    render(<Probe />);
    const rows = screen.getAllByTestId('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      '朝A|朝|0|0',
      '朝B|朝|0|0',
      '夜A|夜|0|0',
    ]);
  });

  it('stash_view に行が無いタスクは null 集計でも一覧に出る', () => {
    state$.time_slots.assign({
      s1: {
        id: 's1',
        user_id: 'u',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.tasks.assign({
      x: {
        id: 'x',
        user_id: 'u',
        time_slot_id: 's1',
        name: '新タスク',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    // task_stash_view は空のまま
    render(<Probe />);
    const rows = screen.getAllByTestId('row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('新タスク|朝|0|0');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd apps/habits && pnpm exec vitest run src/hooks/useTaskStashList.test.tsx
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`apps/habits/src/hooks/useTaskStashList.ts`:

```ts
import { use$ } from '@legendapp/state/react';
import { state$, type Task, type TaskStashView, type TimeSlot } from '@org/habit-sync';

export interface TaskStashRow {
  task_id: string;
  task_name: string;
  slot_name: string;
  complete_count: number | null;
  fail_count: number | null;
  skip_count: number | null;
  current_streak: number | null;
  task_days: number | null;
  completion_rate: number | null;
  last_completed_date: string | null;
}

// アーカイブされていないタスクのみを対象に、task_stash_view との JOIN 相当を行い、
// 時間帯 sort_order → タスク sort_order でソートして返す。
// stash_view に行が無いタスクは全カラム null の行として返す（新規追加直後の状態）。
export function useTaskStashList(): TaskStashRow[] {
  return use$(() => {
    const tasks = Object.values(state$.tasks.get()) as Task[];
    const slots = Object.values(state$.time_slots.get()) as TimeSlot[];
    const stashes = state$.task_stash_view.get() as Record<string, TaskStashView>;

    const slotById = new Map<string, TimeSlot>();
    for (const s of slots) {
      slotById.set(s.id, s);
    }

    const rows: TaskStashRow[] = [];
    for (const t of tasks) {
      if (t.archived_at !== null) {
        continue;
      }
      const slot = slotById.get(t.time_slot_id);
      if (slot === undefined) {
        continue;
      }
      const stash = stashes[t.id];
      rows.push({
        task_id: t.id,
        task_name: t.name,
        slot_name: slot.name,
        complete_count: stash?.complete_count ?? null,
        fail_count: stash?.fail_count ?? null,
        skip_count: stash?.skip_count ?? null,
        current_streak: stash?.current_streak ?? null,
        task_days: stash?.task_days ?? null,
        completion_rate: stash?.completion_rate ?? null,
        last_completed_date: stash?.last_completed_date ?? null,
      });
    }

    // スロット sort_order → タスク sort_order
    rows.sort((a, b) => {
      const slotA = slotById.get(
        (tasks.find((t) => t.id === a.task_id) as Task).time_slot_id,
      ) as TimeSlot;
      const slotB = slotById.get(
        (tasks.find((t) => t.id === b.task_id) as Task).time_slot_id,
      ) as TimeSlot;
      if (slotA.sort_order !== slotB.sort_order) {
        return slotA.sort_order - slotB.sort_order;
      }
      const taskA = tasks.find((t) => t.id === a.task_id) as Task;
      const taskB = tasks.find((t) => t.id === b.task_id) as Task;
      return taskA.sort_order - taskB.sort_order;
    });

    return rows;
  });
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd apps/habits && pnpm exec vitest run src/hooks/useTaskStashList.test.tsx
```

Expected: PASS（4 件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/hooks/useTaskStashList.ts apps/habits/src/hooks/useTaskStashList.test.tsx
git commit -m "feat(habits): add useTaskStashList hook joining tasks + task_stash_view"
```

---

## Task 5: PendingSyncBadge コンポーネント

**Files:**
- Create: `apps/habits/src/features/stash/PendingSyncBadge.tsx`
- Test: `apps/habits/src/features/stash/PendingSyncBadge.test.tsx`

オフライン or 未同期件数 >= 1 のとき表示。両方の場合は両方を併記。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/features/stash/PendingSyncBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { online$, state$ } from '@org/habit-sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// usePendingSyncCount を差し替えるためにモジュールモック
vi.mock('../../hooks/usePendingSyncCount.js', () => ({
  usePendingSyncCount: (): number => mockedCount,
}));

let mockedCount = 0;

import { PendingSyncBadge } from './PendingSyncBadge.js';

beforeEach(() => {
  mockedCount = 0;
  online$.set(true);
  state$.tasks.set({});
});
afterEach(() => {
  mockedCount = 0;
  online$.set(true);
  state$.tasks.set({});
});

describe('PendingSyncBadge', () => {
  it('オンライン & 未同期 0 件のとき何も描画しない', () => {
    const { container } = render(<PendingSyncBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('オフラインのとき「オフライン」を表示する', () => {
    online$.set(false);
    render(<PendingSyncBadge />);
    expect(screen.getByText(/オフライン/)).toBeInTheDocument();
  });

  it('未同期 1 件以上のとき「同期前 N 件」を表示する', () => {
    mockedCount = 3;
    render(<PendingSyncBadge />);
    expect(screen.getByText(/同期前\s*3\s*件/)).toBeInTheDocument();
  });

  it('オフライン + 未同期 2 件のとき両方を表示する', () => {
    online$.set(false);
    mockedCount = 2;
    render(<PendingSyncBadge />);
    expect(screen.getByText(/オフライン/)).toBeInTheDocument();
    expect(screen.getByText(/同期前\s*2\s*件/)).toBeInTheDocument();
  });

  it('role=status を持つ（スクリーンリーダー対応）', () => {
    online$.set(false);
    render(<PendingSyncBadge />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd apps/habits && pnpm exec vitest run src/features/stash/PendingSyncBadge.test.tsx
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`apps/habits/src/features/stash/PendingSyncBadge.tsx`:

```tsx
import type React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { usePendingSyncCount } from '../../hooks/usePendingSyncCount.js';

// オフラインまたは pending 件数 >= 1 のとき表示するバッジ。
// 両方の場合は両方を併記する。
export function PendingSyncBadge(): React.ReactElement | null {
  const online = useOnlineStatus();
  const pending = usePendingSyncCount();

  if (online && pending === 0) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
    >
      {!online ? <span>● オフライン</span> : null}
      {pending > 0 ? <span>同期前 {pending} 件</span> : null}
    </div>
  );
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd apps/habits && pnpm exec vitest run src/features/stash/PendingSyncBadge.test.tsx
```

Expected: PASS（5 件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/features/stash/PendingSyncBadge.tsx apps/habits/src/features/stash/PendingSyncBadge.test.tsx
git commit -m "feat(habits): add PendingSyncBadge for offline / pending sync display"
```

---

## Task 6: StashRow コンポーネント

**Files:**
- Create: `apps/habits/src/features/stash/StashRow.tsx`
- Test: `apps/habits/src/features/stash/StashRow.test.tsx`

1 タスクの集計を 1 行表示。`stash-format` のフォーマッタを利用。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/features/stash/StashRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TaskStashRow } from '../../hooks/useTaskStashList.js';
import { StashRow } from './StashRow.js';

const FULL: TaskStashRow = {
  task_id: 't1',
  task_name: '歯を磨く',
  slot_name: '朝',
  complete_count: 12,
  fail_count: 1,
  skip_count: 2,
  current_streak: 5,
  task_days: 20,
  completion_rate: 0.6,
  last_completed_date: '2026-05-15',
};

describe('StashRow', () => {
  it('タスク名と時間帯名を表示する', () => {
    render(<StashRow row={FULL} />);
    expect(screen.getByText('歯を磨く')).toBeInTheDocument();
    expect(screen.getByText('朝')).toBeInTheDocument();
  });

  it('各カウントとフォーマット済み値を表示する', () => {
    render(<StashRow row={FULL} />);
    expect(screen.getByText('12')).toBeInTheDocument(); // complete
    expect(screen.getByText('1')).toBeInTheDocument(); // fail
    expect(screen.getByText('2')).toBeInTheDocument(); // skip
    expect(screen.getByText('5')).toBeInTheDocument(); // streak
    expect(screen.getByText('20')).toBeInTheDocument(); // task_days
    expect(screen.getByText('60%')).toBeInTheDocument(); // completion_rate
    expect(screen.getByText('2026-05-15')).toBeInTheDocument();
  });

  it('null カラムは 0 または — で表示する', () => {
    const empty: TaskStashRow = {
      ...FULL,
      complete_count: null,
      fail_count: null,
      skip_count: null,
      current_streak: null,
      task_days: null,
      completion_rate: null,
      last_completed_date: null,
    };
    render(<StashRow row={empty} />);
    // 0 が複数出る（complete/fail/skip/streak/task_days = 5 個）
    expect(screen.getAllByText('0')).toHaveLength(5);
    // completion_rate と last_completed_date は —
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd apps/habits && pnpm exec vitest run src/features/stash/StashRow.test.tsx
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`apps/habits/src/features/stash/StashRow.tsx`:

```tsx
import type React from 'react';
import type { TaskStashRow } from '../../hooks/useTaskStashList.js';
import {
  formatCompletionRate,
  formatLastCompletedDate,
  formatStashCount,
} from '../../lib/stash-format.js';

export interface StashRowProps {
  row: TaskStashRow;
}

// 1 タスクの集計 1 行を表示。レスポンシブのため、md 未満は折り返す。
export function StashRow({ row }: StashRowProps): React.ReactElement {
  return (
    <article className="rounded border border-gray-700 bg-gray-900/40 p-3 space-y-2">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{row.task_name}</h3>
        <span className="text-xs text-gray-400">{row.slot_name}</span>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4">
        <div>
          <dt className="text-gray-400">完了</dt>
          <dd>{formatStashCount(row.complete_count)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">スキップ</dt>
          <dd>{formatStashCount(row.skip_count)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">失敗</dt>
          <dd>{formatStashCount(row.fail_count)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">連続</dt>
          <dd>{formatStashCount(row.current_streak)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">対象日数</dt>
          <dd>{formatStashCount(row.task_days)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">完了率</dt>
          <dd>{formatCompletionRate(row.completion_rate)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-gray-400">最終完了</dt>
          <dd>{formatLastCompletedDate(row.last_completed_date)}</dd>
        </div>
      </dl>
    </article>
  );
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd apps/habits && pnpm exec vitest run src/features/stash/StashRow.test.tsx
```

Expected: PASS（3 件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/features/stash/StashRow.tsx apps/habits/src/features/stash/StashRow.test.tsx
git commit -m "feat(habits): add StashRow component for per-task stash display"
```

---

## Task 7: StashPanel コンポーネント

**Files:**
- Create: `apps/habits/src/features/stash/StashPanel.tsx`
- Test: `apps/habits/src/features/stash/StashPanel.test.tsx`

`useTaskStashList()` の結果を `StashRow` で並べ、上部に `PendingSyncBadge` を配置。空状態の文言も対応。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/features/stash/StashPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskStashRow } from '../../hooks/useTaskStashList.js';

let mockedRows: TaskStashRow[] = [];

vi.mock('../../hooks/useTaskStashList.js', () => ({
  useTaskStashList: (): TaskStashRow[] => mockedRows,
}));

// PendingSyncBadge は別途テスト済み。ここではマウントを確認するだけ
vi.mock('./PendingSyncBadge.js', () => ({
  PendingSyncBadge: () => <div data-testid="badge" />,
}));

import { StashPanel } from './StashPanel.js';

beforeEach(() => {
  mockedRows = [];
});
afterEach(() => {
  mockedRows = [];
});

describe('StashPanel', () => {
  it('PendingSyncBadge を描画する', () => {
    render(<StashPanel />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('rows 空のとき empty メッセージを表示', () => {
    render(<StashPanel />);
    expect(screen.getByText(/まだ集計対象のタスクがありません/)).toBeInTheDocument();
  });

  it('rows が複数あるとき task_name ごとに表示', () => {
    mockedRows = [
      {
        task_id: 'a',
        task_name: 'A',
        slot_name: '朝',
        complete_count: 1,
        fail_count: 0,
        skip_count: 0,
        current_streak: 1,
        task_days: 1,
        completion_rate: 1,
        last_completed_date: '2026-05-16',
      },
      {
        task_id: 'b',
        task_name: 'B',
        slot_name: '夜',
        complete_count: 2,
        fail_count: 0,
        skip_count: 0,
        current_streak: 2,
        task_days: 2,
        completion_rate: 1,
        last_completed_date: '2026-05-16',
      },
    ];
    render(<StashPanel />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd apps/habits && pnpm exec vitest run src/features/stash/StashPanel.test.tsx
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`apps/habits/src/features/stash/StashPanel.tsx`:

```tsx
import type React from 'react';
import { useTaskStashList } from '../../hooks/useTaskStashList.js';
import { PendingSyncBadge } from './PendingSyncBadge.js';
import { StashRow } from './StashRow.js';

export function StashPanel(): React.ReactElement {
  const rows = useTaskStashList();

  return (
    <div className="space-y-4">
      <PendingSyncBadge />
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">
          まだ集計対象のタスクがありません。タスクを追加するか、操作してから戻ってください。
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <StashRow key={row.task_id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd apps/habits && pnpm exec vitest run src/features/stash/StashPanel.test.tsx
```

Expected: PASS（3 件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/features/stash/StashPanel.tsx apps/habits/src/features/stash/StashPanel.test.tsx
git commit -m "feat(habits): add StashPanel composing PendingSyncBadge + StashRow list"
```

---

## Task 8: StashPage ルートページ

**Files:**
- Create: `apps/habits/src/routes/stash/StashPage.tsx`
- Test: `apps/habits/src/routes/stash/StashPage.test.tsx`

ヘッダー + 「今日のタスク」へ戻るリンク + `StashPanel` を組み合わせる。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/routes/stash/StashPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}));

vi.mock('../../features/stash/StashPanel.js', () => ({
  StashPanel: () => <div data-testid="stash-panel" />,
}));

import { StashPage } from './StashPage.js';

describe('StashPage', () => {
  it('「スタッシュ」見出しを表示する', () => {
    render(<StashPage />);
    expect(screen.getByRole('heading', { name: 'スタッシュ' })).toBeInTheDocument();
  });

  it('今日のタスクへ戻るリンクを表示する', () => {
    render(<StashPage />);
    const link = screen.getByRole('link', { name: '今日のタスク' });
    expect(link).toHaveAttribute('href', '/today');
  });

  it('StashPanel を描画する', () => {
    render(<StashPage />);
    expect(screen.getByTestId('stash-panel')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd apps/habits && pnpm exec vitest run src/routes/stash/StashPage.test.tsx
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`apps/habits/src/routes/stash/StashPage.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import type React from 'react';
import { StashPanel } from '../../features/stash/StashPanel.js';

export function StashPage(): React.ReactElement {
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-game-accent">スタッシュ</h1>
        <nav className="flex items-center gap-2">
          <Link to="/today" className="rounded border border-gray-500 px-3 py-1 text-sm">
            今日のタスク
          </Link>
        </nav>
      </header>
      <StashPanel />
    </section>
  );
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd apps/habits && pnpm exec vitest run src/routes/stash/StashPage.test.tsx
```

Expected: PASS（3 件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/routes/stash/StashPage.tsx apps/habits/src/routes/stash/StashPage.test.tsx
git commit -m "feat(habits): add /stash route page with header + StashPanel"
```

---

## Task 9: router.tsx に /stash ルートを追加

**Files:**
- Modify: `apps/habits/src/router.tsx`
- Modify: `apps/habits/src/App.test.tsx`

`requireAuth` 付きの `stashRoute` を追加し、`routeTree` に登録。

- [ ] **Step 1: App.test.tsx に /stash ルーティングテストを追加（失敗するテスト）**

`apps/habits/src/App.test.tsx` の既存テストに以下を追加（describe ブロック内）:

```tsx
  it('/stash で StashPage を表示する', async () => {
    setSession({ user: { id: 'u' } } as unknown as Session);
    history.replaceState(null, '', '/stash');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'スタッシュ' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd apps/habits && pnpm exec vitest run src/App.test.tsx
```

Expected: FAIL（/stash ルート未登録）

- [ ] **Step 3: router.tsx を更新**

`apps/habits/src/router.tsx` を以下の完全な内容で置き換える:

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
import { StashPage } from './routes/stash/StashPage.js';
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

const stashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stash',
  beforeLoad: requireAuth,
  component: StashPage,
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
  stashRoute,
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

- [ ] **Step 4: テスト pass を確認**

```bash
cd apps/habits && pnpm exec vitest run src/App.test.tsx
```

Expected: PASS（追加した 1 件含む全件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/router.tsx apps/habits/src/App.test.tsx
git commit -m "feat(habits): wire /stash route with requireAuth"
```

---

## Task 10: Today nav にスタッシュリンクを追加

**Files:**
- Modify: `apps/habits/src/features/today/Today.tsx`
- Modify: `apps/habits/src/features/today/Today.test.tsx`

Today ヘッダーの `<nav>` に `/stash` リンクを追加。

- [ ] **Step 1: Today.test.tsx に失敗するテストを追加**

`apps/habits/src/features/today/Today.test.tsx` の既存 describe 末尾に追加:

```tsx
  it('スタッシュリンクが表示される', () => {
    render(<Today />);
    expect(screen.getByRole('link', { name: 'スタッシュ' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd apps/habits && pnpm exec vitest run src/features/today/Today.test.tsx
```

Expected: FAIL（リンク未追加）

- [ ] **Step 3: Today.tsx を更新**

`apps/habits/src/features/today/Today.tsx` を以下の完全な内容で置き換える:

```tsx
import { Link, useNavigate } from '@tanstack/react-router';
import { signOut } from '../../lib/auth.js';
import { getAppSupabase } from '../../lib/supabase.js';
import { getTodayDateString } from '../../lib/today-date.js';
import { TodayView } from './TodayView.js';

export function Today(): React.ReactElement {
  const navigate = useNavigate();
  const today = getTodayDateString();

  const handleSignOut = async (): Promise<void> => {
    await signOut(getAppSupabase());
    navigate({ to: '/auth/login' });
  };

  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-game-accent">今日のタスク</h1>
        <nav className="flex items-center gap-2">
          <Link to="/tasks" className="rounded border border-gray-500 px-3 py-1 text-sm">
            タスク管理
          </Link>
          <Link to="/stash" className="rounded border border-gray-500 px-3 py-1 text-sm">
            スタッシュ
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
      <TodayView today={today} />
    </section>
  );
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd apps/habits && pnpm exec vitest run src/features/today/Today.test.tsx
```

Expected: PASS（追加 1 件含む全件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/features/today/Today.tsx apps/habits/src/features/today/Today.test.tsx
git commit -m "feat(habits): add stash link to Today navigation"
```

---

## Task 11: CLAUDE.md を更新

**Files:**
- Modify: `CLAUDE.md`

M8 セクションを追加。M7 セクションの直後に挿入。

- [ ] **Step 1: CLAUDE.md を更新**

`CLAUDE.md` の `### タスク管理 / 時間帯設定（M7 以降）` セクションの直後（次のセクションの直前）に以下を挿入する:

```markdown
### スタッシュ（集計表示）/ オフライン可視化（M8 以降）

- `/stash`: 全アクティブタスクの集計（完了数 / スキップ / 失敗 / 連続 / 対象日数 / 完了率 / 最終完了日）を一覧
- `apps/habits/src/features/stash/` 配下に `PendingSyncBadge` / `StashRow` / `StashPanel` を実装
- `state$.task_stash_view`（VIEW、read-only）を購読、`state$.tasks` と join して時間帯 / sort_order 順
- `PendingSyncBadge`: `online$ === false` または `getPendingSyncCount(state$) >= 1` のとき表示。両方を同時に併記
- React フック: `useOnlineStatus` / `usePendingSyncCount` / `useTaskStashList` を `apps/habits/src/hooks/` に追加
- フォーマッタ: `apps/habits/src/lib/stash-format.ts` の `formatStashCount` / `formatCompletionRate` / `formatLastCompletedDate`（null セーフ）
- Today 画面のヘッダー nav から `/stash` へ遷移可能
```

- [ ] **Step 2: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: document M8 stash panel section in CLAUDE.md"
```

---

## 完了検証

すべてのタスク完了後、最終チェック:

- [ ] **typecheck / test 全件**

```bash
cd /Users/ikomiki/workspace/daily-task
CI=true pnpm nx affected -t typecheck lint test --skip-nx-cache
```

Expected: 全プロジェクト緑、新規追加分のテストすべて pass

- [ ] **biome check**

```bash
pnpm exec biome ci .
```

Expected: PASS

- [ ] **手動確認（任意、Supabase 起動済の場合）**

```bash
supabase start
pnpm nx serve habits
```

ブラウザで:

1. `/today` に着地 → ヘッダーに「スタッシュ」リンクが見える
2. クリックで `/stash` 遷移 → 各タスクが行表示、初期は完了 0 / 連続 0 / 完了率 — / 最終完了 —
3. DevTools で「Network: Offline」 → `/stash` 上部に「● オフライン」 + タスクを操作（戻って `/today` で完了押下）→ 戻って `/stash` で「同期前 N 件」が併記
4. Online 復帰 → 数秒以内にバッジが消え、カウントが反映される

---

## スコープ外（M9 以降）

- 履歴画面（過去ログ遅延ロード） → M9
- 通知 v1 → M10
- PWA / Service Worker → M11
- スタッシュの並べ替えオプション（完了率順、連続順）→ 将来拡張
- アーカイブ済タスクを含む全集計の表示 → 将来拡張
