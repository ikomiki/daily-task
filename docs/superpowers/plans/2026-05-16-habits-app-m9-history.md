# Habits App M9: 履歴画面 (過去ログ遅延取得) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/history` ルートを追加し、選択したタスクの過去 task_logs を時系列降順で表示。既存の購読データ（直近 31 日）と Supabase から遅延取得する 32 日以前のデータを統合表示し、「もっと読み込む」で追加ページを取得する。

**Architecture:** 過去ログは `state$.task_logs` に保存せず、`packages/habit-sync` の `loadTaskHistory(client, opts)` でその場取得 → React の `useState` で履歴画面のローカル state に保持し、`state$.task_logs`（直近 31 日）とマージして表示する。書き込みは行わない（読み取り専用）。

**Tech Stack:** React 19, TanStack Router, legend-state v3 beta (`use$`), `@supabase/supabase-js`, vitest + testing-library

---

## ファイル構成

新規作成:

| パス | 責務 |
|---|---|
| `packages/habit-sync/src/history.ts` | `loadTaskHistory(client, opts)` 非同期関数 |
| `packages/habit-sync/src/history.test.ts` | 上記関数のユニットテスト |
| `apps/habits/src/lib/history-status.ts` | `TaskStatus` 値を日本語ラベルに変換する純粋関数 |
| `apps/habits/src/lib/history-status.test.ts` | 上記関数のテスト |
| `apps/habits/src/hooks/useTaskHistory.ts` | 選択中タスクの過去ログを購読＋遅延取得するフック |
| `apps/habits/src/hooks/useTaskHistory.test.tsx` | 上記フックのテスト |
| `apps/habits/src/features/history/HistoryView.tsx` | タスク選択 + 履歴一覧 + 「もっと読み込む」 UI |
| `apps/habits/src/features/history/HistoryView.test.tsx` | 上記コンポーネントのテスト |
| `apps/habits/src/routes/history/HistoryPage.tsx` | `/history` ルートのページ（ヘッダー + HistoryView） |
| `apps/habits/src/routes/history/HistoryPage.test.tsx` | 上記コンポーネントのテスト |

修正:

| パス | 修正内容 |
|---|---|
| `packages/habit-sync/src/index.ts` | `loadTaskHistory` と `LoadTaskHistoryOptions` を re-export |
| `apps/habits/src/router.tsx` | `/history` ルートを `requireAuth` 付きで追加 |
| `apps/habits/src/App.test.tsx` | `/history` ルーティングテストを 1 件追加 |
| `apps/habits/src/features/today/Today.tsx` | nav に「履歴」リンクを追加 |
| `apps/habits/src/features/today/Today.test.tsx` | 履歴リンク表示テストを 1 件追加 |
| `CLAUDE.md` | 「履歴（M9 以降）」セクションを追加 |

データ流れ:

```
state$.task_logs (直近 31 日, syncedSupabase 接続済) ─┐
                                                      ├─→ useTaskHistory(taskId).logs
loadTaskHistory(client, {taskId, beforeDate, limit}) ─┘     (date 降順マージ)
       ↑                                                   ↓
       └─ useTaskHistory.loadMore() で呼び出し         HistoryView (UI)
```

`loadTaskHistory` は Supabase に対し `task_id = X AND date < beforeDate ORDER BY date DESC LIMIT 31` のクエリを発行。`state$` には保存せず、フック内 `useState` で保持する。これにより:

- 直近 31 日は既存の Realtime 経路で常に最新
- 32 日以前は画面表示時のみオンデマンド取得（メモリと帯域節約）
- ページ離脱で破棄、再訪時は再取得

---

## Task 1: loadTaskHistory ユーティリティ

**Files:**
- Create: `packages/habit-sync/src/history.ts`
- Test: `packages/habit-sync/src/history.test.ts`
- Modify: `packages/habit-sync/src/index.ts`

Supabase クライアントから単一タスクの過去 task_logs を date 降順で取得する非同期関数。

- [ ] **Step 1: 失敗するテストを作成**

`packages/habit-sync/src/history.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { loadTaskHistory } from './history.js';

interface MockBuilder {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
}

// PostgrestFilterBuilder のチェーン API を模倣
function makeClient(
  result: { data: unknown; error: unknown },
): { client: unknown; calls: MockBuilder } {
  const calls: MockBuilder = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  // チェーンメソッドは builder 自体を返し、limit は thenable Promise を返す
  const builder = {
    from: (...args: unknown[]) => {
      calls.from(...args);
      return builder;
    },
    select: (...args: unknown[]) => {
      calls.select(...args);
      return builder;
    },
    eq: (...args: unknown[]) => {
      calls.eq(...args);
      return builder;
    },
    lt: (...args: unknown[]) => {
      calls.lt(...args);
      return builder;
    },
    order: (...args: unknown[]) => {
      calls.order(...args);
      return builder;
    },
    limit: (...args: unknown[]) => {
      calls.limit(...args);
      return Promise.resolve(result);
    },
  };
  return { client: builder, calls };
}

describe('loadTaskHistory', () => {
  it('正しいクエリでフェッチし、data を返す', async () => {
    const rows = [
      {
        task_id: 't1',
        date: '2026-04-10',
        status: 'complete',
        created_at: '2026-04-10T00:00:00Z',
        updated_at: '2026-04-10T00:00:00Z',
      },
    ];
    const { client, calls } = makeClient({ data: rows, error: null });

    // biome-ignore lint/suspicious/noExplicitAny: テスト用モック
    const result = await loadTaskHistory(client as any, {
      taskId: 't1',
      beforeDate: '2026-04-15',
      limit: 31,
    });

    expect(calls.from).toHaveBeenCalledWith('task_logs');
    expect(calls.select).toHaveBeenCalledWith('*');
    expect(calls.eq).toHaveBeenCalledWith('task_id', 't1');
    expect(calls.lt).toHaveBeenCalledWith('date', '2026-04-15');
    expect(calls.order).toHaveBeenCalledWith('date', { ascending: false });
    expect(calls.limit).toHaveBeenCalledWith(31);
    expect(result).toEqual(rows);
  });

  it('limit 省略時は 31 件', async () => {
    const { client, calls } = makeClient({ data: [], error: null });
    // biome-ignore lint/suspicious/noExplicitAny: テスト用モック
    await loadTaskHistory(client as any, { taskId: 't1', beforeDate: '2026-04-15' });
    expect(calls.limit).toHaveBeenCalledWith(31);
  });

  it('data が null の場合は空配列を返す', async () => {
    const { client } = makeClient({ data: null, error: null });
    // biome-ignore lint/suspicious/noExplicitAny: テスト用モック
    const result = await loadTaskHistory(client as any, {
      taskId: 't1',
      beforeDate: '2026-04-15',
    });
    expect(result).toEqual([]);
  });

  it('error がある場合は throw', async () => {
    const err = new Error('db error');
    const { client } = makeClient({ data: null, error: err });
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: テスト用モック
      loadTaskHistory(client as any, { taskId: 't1', beforeDate: '2026-04-15' }),
    ).rejects.toThrow('db error');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm nx test @org/habit-sync -- --run src/history.test.ts
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`packages/habit-sync/src/history.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './db-types.js';
import type { TaskLog } from './types.js';

export interface LoadTaskHistoryOptions {
  taskId: string;
  beforeDate: string; // 'YYYY-MM-DD' — この日付より前（未満）の log を取得
  limit?: number; // 既定 31
}

// 単一タスクの過去 task_logs を date 降順で取得する。
// state$ には保存せず、呼び出し側でローカル state に保持する想定。
// 直近 31 日は state$.task_logs で購読済のため、beforeDate には既存ログの最古日付を渡す。
export async function loadTaskHistory(
  client: SupabaseClient,
  options: LoadTaskHistoryOptions,
): Promise<TaskLog[]> {
  const typed = client as unknown as SupabaseClient<Database>;
  const limit = options.limit ?? 31;
  const { data, error } = await typed
    .from('task_logs')
    .select('*')
    .eq('task_id', options.taskId)
    .lt('date', options.beforeDate)
    .order('date', { ascending: false })
    .limit(limit);
  if (error !== null) {
    throw error;
  }
  return data ?? [];
}
```

- [ ] **Step 4: index.ts に re-export を追加**

`packages/habit-sync/src/index.ts` の既存 export 群に以下を追加（アルファベット順を維持）:

```ts
export type { LoadTaskHistoryOptions } from './history.js';
export { loadTaskHistory } from './history.js';
```

挿入位置: `export { getPendingSyncCount } from './pending-sync.js';` の直後に置く（alphabetical: history < pending-sync の後に来ない、`./history.js` は files level で `pending-sync` より前）。注意: 重要なのは Biome の organize-imports に従えば自動整列されること。アルファベット順の細部は biome に任せる。

- [ ] **Step 5: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm nx test @org/habit-sync -- --run src/history.test.ts
```

Expected: PASS（4 件）

- [ ] **Step 6: 全体検証**

```bash
cd /Users/ikomiki/workspace/daily-task && CI=true pnpm nx test @org/habit-sync && pnpm exec biome ci packages/habit-sync/src/history.ts packages/habit-sync/src/history.test.ts packages/habit-sync/src/index.ts
```

Expected: 全 pass、biome clean

- [ ] **Step 7: コミット**

```bash
git add packages/habit-sync/src/history.ts packages/habit-sync/src/history.test.ts packages/habit-sync/src/index.ts
git commit -m "feat(habit-sync): add loadTaskHistory for lazy past-log fetch"
```

---

## Task 2: history-status フォーマッタ

**Files:**
- Create: `apps/habits/src/lib/history-status.ts`
- Test: `apps/habits/src/lib/history-status.test.ts`

`TaskStatus` enum 値（'complete' | 'skip' | 'fail'）を日本語ラベルに変換する純粋関数。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/lib/history-status.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatHistoryStatus } from './history-status.js';

describe('formatHistoryStatus', () => {
  it('complete を「完了」に変換する', () => {
    expect(formatHistoryStatus('complete')).toBe('完了');
  });

  it('skip を「スキップ」に変換する', () => {
    expect(formatHistoryStatus('skip')).toBe('スキップ');
  });

  it('fail を「失敗」に変換する', () => {
    expect(formatHistoryStatus('fail')).toBe('失敗');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/lib/history-status.test.ts
```

Expected: FAIL

- [ ] **Step 3: 実装**

`apps/habits/src/lib/history-status.ts`:

```ts
import type { TaskStatus } from '@org/habit-sync';

// TaskStatus を画面表示用の日本語ラベルに変換する。
// 'empty'（行不在）は履歴一覧では表示しないため対象外。
export function formatHistoryStatus(status: TaskStatus): string {
  switch (status) {
    case 'complete':
      return '完了';
    case 'skip':
      return 'スキップ';
    case 'fail':
      return '失敗';
  }
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/lib/history-status.test.ts
```

Expected: PASS（3 件）

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/lib/history-status.ts apps/habits/src/lib/history-status.test.ts
git commit -m "feat(habits): add formatHistoryStatus label util"
```

---

## Task 3: useTaskHistory フック

**Files:**
- Create: `apps/habits/src/hooks/useTaskHistory.ts`
- Test: `apps/habits/src/hooks/useTaskHistory.test.tsx`

選択中タスクの履歴ログを `state$.task_logs`（直近 31 日）+ 過去取得分にマージ、降順ソートして返す。`loadMore()` で次の 31 日分を Supabase から取得。

戻り値:

```ts
interface UseTaskHistoryResult {
  logs: TaskLog[]; // date 降順
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => Promise<void>;
}
```

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/hooks/useTaskHistory.test.tsx`:

```tsx
import { state$, type TaskLog } from '@org/habit-sync';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// loadTaskHistory をモック化（後続テストで戻り値を切替）
const loadTaskHistoryMock = vi.fn();
vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    loadTaskHistory: (...args: unknown[]): unknown => loadTaskHistoryMock(...args),
  };
});

// supabase は呼び出さない（loadTaskHistory がモックされるため）
vi.mock('../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({}),
}));

import { useTaskHistory } from './useTaskHistory.js';

interface ProbeProps {
  taskId: string | null;
}

function Probe({ taskId }: ProbeProps): React.ReactElement {
  const { logs, hasMore, isLoading, loadMore } = useTaskHistory(taskId);
  return (
    <div>
      <ul>
        {logs.map((l) => (
          <li key={`${l.task_id}-${l.date}`} data-testid="row">
            {l.date}|{l.status}
          </li>
        ))}
      </ul>
      <span data-testid="hasMore">{hasMore ? 'yes' : 'no'}</span>
      <span data-testid="isLoading">{isLoading ? 'yes' : 'no'}</span>
      <button
        type="button"
        onClick={() => {
          void loadMore();
        }}
      >
        loadMore
      </button>
    </div>
  );
}

const NOW = '2026-05-16T00:00:00Z';

function mkLog(taskId: string, date: string, status: 'complete' | 'skip' | 'fail'): TaskLog {
  return { task_id: taskId, date, status, created_at: NOW, updated_at: NOW };
}

beforeEach(() => {
  loadTaskHistoryMock.mockReset();
  state$.task_logs.set({});
});
afterEach(() => {
  loadTaskHistoryMock.mockReset();
  state$.task_logs.set({});
});

describe('useTaskHistory', () => {
  it('taskId が null のとき空配列・hasMore=false', () => {
    render(<Probe taskId={null} />);
    expect(screen.queryAllByTestId('row')).toHaveLength(0);
    expect(screen.getByTestId('hasMore')).toHaveTextContent('no');
  });

  it('state$.task_logs から該当 task の log を date 降順で返す', () => {
    state$.task_logs.assign({
      'a-2026-05-10': mkLog('a', '2026-05-10', 'complete'),
      'a-2026-05-12': mkLog('a', '2026-05-12', 'skip'),
      'a-2026-05-11': mkLog('a', '2026-05-11', 'fail'),
      'b-2026-05-10': mkLog('b', '2026-05-10', 'complete'),
    });
    render(<Probe taskId="a" />);
    const rows = screen.getAllByTestId('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      '2026-05-12|skip',
      '2026-05-11|fail',
      '2026-05-10|complete',
    ]);
  });

  it('loadMore で取得分を末尾にマージする', async () => {
    state$.task_logs.assign({
      'a-2026-05-12': mkLog('a', '2026-05-12', 'complete'),
      'a-2026-05-10': mkLog('a', '2026-05-10', 'fail'),
    });
    loadTaskHistoryMock.mockResolvedValueOnce([
      mkLog('a', '2026-04-30', 'complete'),
      mkLog('a', '2026-04-20', 'skip'),
    ]);
    render(<Probe taskId="a" />);
    expect(screen.getAllByTestId('row')).toHaveLength(2);

    await act(async () => {
      screen.getByRole('button', { name: 'loadMore' }).click();
    });

    expect(loadTaskHistoryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ taskId: 'a', beforeDate: '2026-05-10', limit: 31 }),
    );
    const rows = screen.getAllByTestId('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      '2026-05-12|complete',
      '2026-05-10|fail',
      '2026-04-30|complete',
      '2026-04-20|skip',
    ]);
  });

  it('返却件数が limit 未満なら hasMore=false', async () => {
    state$.task_logs.assign({
      'a-2026-05-10': mkLog('a', '2026-05-10', 'complete'),
    });
    loadTaskHistoryMock.mockResolvedValueOnce([mkLog('a', '2026-04-30', 'complete')]);
    render(<Probe taskId="a" />);

    await act(async () => {
      screen.getByRole('button', { name: 'loadMore' }).click();
    });

    expect(screen.getByTestId('hasMore')).toHaveTextContent('no');
  });

  it('既存ログが無い状態で loadMore しても fetch しない', async () => {
    render(<Probe taskId="a" />);
    await act(async () => {
      screen.getByRole('button', { name: 'loadMore' }).click();
    });
    expect(loadTaskHistoryMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('hasMore')).toHaveTextContent('no');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/hooks/useTaskHistory.test.tsx
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装**

`apps/habits/src/hooks/useTaskHistory.ts`:

```ts
import { use$ } from '@legendapp/state/react';
import { loadTaskHistory, state$, type TaskLog } from '@org/habit-sync';
import { useCallback, useEffect, useState } from 'react';
import { getAppSupabase } from '../lib/supabase.js';

export interface UseTaskHistoryResult {
  logs: TaskLog[]; // date 降順（最新が先頭）
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => Promise<void>;
}

const PAGE_SIZE = 31;

// 選択中タスクの履歴ログを返す。
// - 直近 31 日: state$.task_logs から該当 task_id を抽出
// - 32 日以前: loadMore() で Supabase から PAGE_SIZE 件ずつ追加取得
// - 取得結果が PAGE_SIZE 未満なら hasMore=false で打ち切り
export function useTaskHistory(taskId: string | null): UseTaskHistoryResult {
  const recentLogs = use$<TaskLog[]>(() => {
    if (taskId === null) {
      return [];
    }
    const all = Object.values(state$.task_logs.get()) as TaskLog[];
    return all
      .filter((l) => l.task_id === taskId)
      .sort((a, b) => b.date.localeCompare(a.date));
  });

  const [pastLogs, setPastLogs] = useState<TaskLog[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // taskId が変わったらローカル state を完全リセット
  useEffect(() => {
    setPastLogs([]);
    setHasMore(true);
    setIsLoading(false);
  }, [taskId]);

  const logs: TaskLog[] = [...recentLogs, ...pastLogs];

  const loadMore = useCallback(async (): Promise<void> => {
    if (taskId === null || isLoading || !hasMore) {
      return;
    }
    const oldest = logs[logs.length - 1]?.date;
    if (oldest === undefined) {
      // 既存ログ無し → cursor が決まらないので打ち切り
      setHasMore(false);
      return;
    }
    setIsLoading(true);
    try {
      const batch = await loadTaskHistory(getAppSupabase(), {
        taskId,
        beforeDate: oldest,
        limit: PAGE_SIZE,
      });
      if (batch.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setPastLogs((prev) => [...prev, ...batch]);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, isLoading, hasMore, logs]);

  return { logs, hasMore, isLoading, loadMore };
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/hooks/useTaskHistory.test.tsx
```

Expected: PASS（5 件）

- [ ] **Step 5: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/hooks/useTaskHistory.ts apps/habits/src/hooks/useTaskHistory.test.tsx
git add apps/habits/src/hooks/useTaskHistory.ts apps/habits/src/hooks/useTaskHistory.test.tsx
git commit -m "feat(habits): add useTaskHistory hook merging state\$ + lazy past fetch"
```

---

## Task 4: HistoryView コンポーネント

**Files:**
- Create: `apps/habits/src/features/history/HistoryView.tsx`
- Test: `apps/habits/src/features/history/HistoryView.test.tsx`

タスク選択 `<select>` + 選択中タスクの履歴一覧 + 「もっと読み込む」ボタンを統合表示。

- アクティブ + アーカイブ済を全て選択肢に出す（履歴閲覧用のため）
- 初期選択はタスク一覧の先頭、タスクゼロ時は空状態メッセージ

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/features/history/HistoryView.test.tsx`:

```tsx
import { state$, type TaskLog } from '@org/habit-sync';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadTaskHistoryMock = vi.fn();
vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    loadTaskHistory: (...args: unknown[]): unknown => loadTaskHistoryMock(...args),
  };
});

vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({}),
}));

import { HistoryView } from './HistoryView.js';

const NOW = '2026-05-16T00:00:00Z';

function mkLog(taskId: string, date: string, status: 'complete' | 'skip' | 'fail'): TaskLog {
  return { task_id: taskId, date, status, created_at: NOW, updated_at: NOW };
}

beforeEach(() => {
  loadTaskHistoryMock.mockReset();
  state$.tasks.set({});
  state$.task_logs.set({});
  state$.time_slots.set({});
});
afterEach(() => {
  loadTaskHistoryMock.mockReset();
  state$.tasks.set({});
  state$.task_logs.set({});
  state$.time_slots.set({});
});

describe('HistoryView', () => {
  it('タスクが無いとき空状態メッセージを表示', () => {
    render(<HistoryView />);
    expect(screen.getByText(/タスクが登録されていません/)).toBeInTheDocument();
  });

  it('タスクを select で表示し、選択中タスクの履歴を一覧表示', () => {
    state$.tasks.assign({
      a: {
        id: 'a',
        user_id: 'u',
        time_slot_id: 's1',
        name: '歯を磨く',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.task_logs.assign({
      'a-2026-05-15': mkLog('a', '2026-05-15', 'complete'),
      'a-2026-05-14': mkLog('a', '2026-05-14', 'fail'),
    });
    render(<HistoryView />);
    // select に「歯を磨く」が含まれる
    expect(screen.getByRole('combobox', { name: 'タスク選択' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '歯を磨く' })).toBeInTheDocument();
    // 履歴が降順で表示
    const rows = screen.getAllByTestId('history-entry');
    expect(rows[0]).toHaveTextContent('2026-05-15');
    expect(rows[0]).toHaveTextContent('完了');
    expect(rows[1]).toHaveTextContent('2026-05-14');
    expect(rows[1]).toHaveTextContent('失敗');
  });

  it('アーカイブ済タスクも選択肢に出す', () => {
    state$.tasks.assign({
      x: {
        id: 'x',
        user_id: 'u',
        time_slot_id: 's1',
        name: 'アーカイブ済',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: '2026-05-15T00:00:00Z',
        created_at: NOW,
        updated_at: NOW,
      },
    });
    render(<HistoryView />);
    expect(screen.getByRole('option', { name: 'アーカイブ済' })).toBeInTheDocument();
  });

  it('hasMore=true のとき「もっと読み込む」ボタンを表示し、クリックで loadTaskHistory が呼ばれる', async () => {
    state$.tasks.assign({
      a: {
        id: 'a',
        user_id: 'u',
        time_slot_id: 's1',
        name: 'A',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.task_logs.assign({
      'a-2026-05-15': mkLog('a', '2026-05-15', 'complete'),
    });
    loadTaskHistoryMock.mockResolvedValueOnce([mkLog('a', '2026-04-30', 'complete')]);
    render(<HistoryView />);
    const btn = screen.getByRole('button', { name: 'もっと読み込む' });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(loadTaskHistoryMock).toHaveBeenCalled();
  });

  it('hasMore=false（loadMore 後に短い batch）でボタンが消える', async () => {
    state$.tasks.assign({
      a: {
        id: 'a',
        user_id: 'u',
        time_slot_id: 's1',
        name: 'A',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.task_logs.assign({
      'a-2026-05-15': mkLog('a', '2026-05-15', 'complete'),
    });
    loadTaskHistoryMock.mockResolvedValueOnce([]);
    render(<HistoryView />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'もっと読み込む' }));
    });
    expect(screen.queryByRole('button', { name: 'もっと読み込む' })).not.toBeInTheDocument();
    expect(screen.getByText(/これ以上履歴はありません/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/features/history/HistoryView.test.tsx
```

Expected: FAIL

- [ ] **Step 3: 実装**

`apps/habits/src/features/history/HistoryView.tsx`:

```tsx
import { use$ } from '@legendapp/state/react';
import { state$, type Task } from '@org/habit-sync';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useTaskHistory } from '../../hooks/useTaskHistory.js';
import { formatHistoryStatus } from '../../lib/history-status.js';

// タスクは active/archived を区別せず、name 昇順で全部選択肢に出す。
// 履歴閲覧の用途上、アーカイブ済タスクも参照できるのが自然なため。
function useAllTasksForHistory(): Task[] {
  return use$(() => {
    const list = Object.values(state$.tasks.get()) as Task[];
    return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  });
}

export function HistoryView(): React.ReactElement {
  const tasks = useAllTasksForHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // タスク一覧が入ったとき、未選択なら先頭を選ぶ
  useEffect(() => {
    if (selectedId === null && tasks.length > 0) {
      setSelectedId(tasks[0].id);
    }
  }, [tasks, selectedId]);

  const { logs, hasMore, isLoading, loadMore } = useTaskHistory(selectedId);

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        タスクが登録されていません。先にタスクを追加してください。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-400">タスク選択</span>
        <select
          aria-label="タスク選択"
          className="rounded border border-gray-500 bg-transparent px-2 py-1"
          value={selectedId ?? ''}
          onChange={(e) => {
            setSelectedId(e.target.value);
          }}
        >
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {logs.length === 0 ? (
        <p className="text-sm text-gray-400">このタスクには履歴がありません。</p>
      ) : (
        <ul className="divide-y divide-gray-700">
          {logs.map((l) => (
            <li
              key={`${l.task_id}-${l.date}`}
              data-testid="history-entry"
              className="flex items-baseline justify-between py-2"
            >
              <span className="text-sm">{l.date}</span>
              <span className="text-sm text-gray-300">{formatHistoryStatus(l.status)}</span>
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            void loadMore();
          }}
          className="rounded border border-gray-500 px-3 py-1 text-sm disabled:opacity-50"
        >
          {isLoading ? '読み込み中...' : 'もっと読み込む'}
        </button>
      ) : (
        <p className="text-xs text-gray-500">これ以上履歴はありません。</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/features/history/HistoryView.test.tsx
```

Expected: PASS（5 件）

- [ ] **Step 5: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/features/history/HistoryView.tsx apps/habits/src/features/history/HistoryView.test.tsx
git add apps/habits/src/features/history/HistoryView.tsx apps/habits/src/features/history/HistoryView.test.tsx
git commit -m "feat(habits): add HistoryView with task selector and lazy paging"
```

---

## Task 5: HistoryPage ルートページ

**Files:**
- Create: `apps/habits/src/routes/history/HistoryPage.tsx`
- Test: `apps/habits/src/routes/history/HistoryPage.test.tsx`

ヘッダー（戻るリンク）+ HistoryView をラップ。

- [ ] **Step 1: 失敗するテストを作成**

`apps/habits/src/routes/history/HistoryPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}));

vi.mock('../../features/history/HistoryView.js', () => ({
  HistoryView: () => <div data-testid="history-view" />,
}));

import { HistoryPage } from './HistoryPage.js';

describe('HistoryPage', () => {
  it('「履歴」見出しを表示する', () => {
    render(<HistoryPage />);
    expect(screen.getByRole('heading', { name: '履歴' })).toBeInTheDocument();
  });

  it('今日のタスクへ戻るリンクを表示する', () => {
    render(<HistoryPage />);
    const link = screen.getByRole('link', { name: '今日のタスク' });
    expect(link).toHaveAttribute('href', '/today');
  });

  it('HistoryView を描画する', () => {
    render(<HistoryPage />);
    expect(screen.getByTestId('history-view')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/routes/history/HistoryPage.test.tsx
```

Expected: FAIL

- [ ] **Step 3: 実装**

`apps/habits/src/routes/history/HistoryPage.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import type React from 'react';
import { HistoryView } from '../../features/history/HistoryView.js';

export function HistoryPage(): React.ReactElement {
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-game-accent">履歴</h1>
        <nav className="flex items-center gap-2">
          <Link to="/today" className="rounded border border-gray-500 px-3 py-1 text-sm">
            今日のタスク
          </Link>
        </nav>
      </header>
      <HistoryView />
    </section>
  );
}
```

- [ ] **Step 4: テスト pass を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/routes/history/HistoryPage.test.tsx
```

Expected: PASS（3 件）

- [ ] **Step 5: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/routes/history/HistoryPage.tsx apps/habits/src/routes/history/HistoryPage.test.tsx
git add apps/habits/src/routes/history/HistoryPage.tsx apps/habits/src/routes/history/HistoryPage.test.tsx
git commit -m "feat(habits): add /history route page with header + HistoryView"
```

---

## Task 6: router.tsx に /history ルートを追加

**Files:**
- Modify: `apps/habits/src/router.tsx`
- Modify: `apps/habits/src/App.test.tsx`

`requireAuth` 付きで `historyRoute` を追加し、`routeTree` に登録。

- [ ] **Step 1: App.test.tsx に失敗するテストを追加**

`apps/habits/src/App.test.tsx` の `describe('App ルーティング', ...)` 内、`/stash` テストの直後に挿入:

```tsx
  it('認証済みで /history にアクセスすると「履歴」ページが表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/history');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '履歴' })).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/App.test.tsx
```

Expected: 1 件 FAIL（/history ルート未登録）

- [ ] **Step 3: router.tsx に historyRoute を追加**

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
import { HistoryPage } from './routes/history/HistoryPage.js';
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

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  beforeLoad: requireAuth,
  component: HistoryPage,
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
  historyRoute,
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
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/App.test.tsx
```

Expected: PASS（新規 1 件含む 10 件全て）

- [ ] **Step 5: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/router.tsx apps/habits/src/App.test.tsx
git add apps/habits/src/router.tsx apps/habits/src/App.test.tsx
git commit -m "feat(habits): wire /history route with requireAuth"
```

---

## Task 7: Today nav に履歴リンクを追加

**Files:**
- Modify: `apps/habits/src/features/today/Today.tsx`
- Modify: `apps/habits/src/features/today/Today.test.tsx`

「履歴」リンクを Today ヘッダー nav に追加。順序は タスク管理 → スタッシュ → 履歴 → 設定。

- [ ] **Step 1: Today.test.tsx に失敗するテストを追加**

`apps/habits/src/features/today/Today.test.tsx` の `describe('Today', ...)` 末尾に追加:

```tsx
  it('履歴リンクが表示される', () => {
    render(<Today />);
    expect(screen.getByRole('link', { name: '履歴' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/features/today/Today.test.tsx
```

Expected: 1 件 FAIL

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
          <Link to="/history" className="rounded border border-gray-500 px-3 py-1 text-sm">
            履歴
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
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/features/today/Today.test.tsx
```

Expected: PASS（新規 1 件含む 7 件全て）

- [ ] **Step 5: Biome 確認 & コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/features/today/Today.tsx apps/habits/src/features/today/Today.test.tsx
git add apps/habits/src/features/today/Today.tsx apps/habits/src/features/today/Today.test.tsx
git commit -m "feat(habits): add history link to Today navigation"
```

---

## Task 8: CLAUDE.md に M9 セクションを追加

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md を更新**

`CLAUDE.md` の `### スタッシュ（集計表示）/ オフライン可視化（M8 以降）` セクション直後（`## E2E（Playwright）` 見出しの直前）に挿入:

```markdown
### 履歴画面 / 過去ログ遅延取得（M9 以降）

- `/history`: 選択中タスクの履歴ログ（date 降順）を遅延ロード式に表示
- `apps/habits/src/features/history/HistoryView.tsx` がタスク選択 + ログ一覧 + 「もっと読み込む」を統合
- 直近 31 日: `state$.task_logs` から該当 task の log を抽出
- 32 日以前: `loadTaskHistory(client, { taskId, beforeDate, limit })` で Supabase からオンデマンド取得（既定 31 件/回）
- 過去ログは `state$` には保存せず、`useTaskHistory(taskId)` フックがローカル state で保持
- ステータスラベル: `apps/habits/src/lib/history-status.ts` の `formatHistoryStatus('complete' | 'skip' | 'fail')`
- 取得結果がページサイズ未満なら hasMore=false に切り替わり「これ以上履歴はありません」表示
- Today 画面のヘッダー nav から `/history` へ遷移可能（アーカイブ済タスクも選択肢に出る）
```

- [ ] **Step 2: コミット**

```bash
git add CLAUDE.md
git commit -m "docs: document M9 history page section in CLAUDE.md"
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

1. `/today` ヘッダーに「履歴」リンクが表示される
2. クリックで `/history` 着地 → タスク選択肢が出る
3. デフォルト選択タスクの直近ログが表示される
4. 「もっと読み込む」クリックで過去 31 日分追加（DevTools の network タブで `task_logs?...lt=date.<...>&limit=31` 確認）
5. データが尽きたら「これ以上履歴はありません」表示
6. 別タスクを select すると pastLogs がリセットされ、直近ログから再描画

---

## スコープ外（将来拡張）

- 履歴ログの編集 / 状態変更（過去日の status を後から修正）→ 将来
- 月単位カレンダー表示 → 将来
- streak 計算結果や頻度マッチ判定の重畳表示 → 将来
- 履歴の CSV / JSON エクスポート → 将来
