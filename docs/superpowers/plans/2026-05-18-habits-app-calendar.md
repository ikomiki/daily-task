# Habits App: 月単位カレンダー画面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`（推奨）または `superpowers:executing-plans` を使用して本プランをタスク単位で実装する。各タスクは Red → Green → Run → Commit の TDD ステップを厳守する。Steps は `- [ ]` チェックボックスで追跡。

## Context

毎日の習慣タスクを管理する Web アプリ `apps/habits` に、過去ログを月単位で俯瞰できる「カレンダー画面」を追加する。既存の M9 履歴画面はテキスト一覧形式のため、月全体の達成パターンを視覚的に把握しづらかった。

添付参考画像（別アプリ）と同型の UI（日曜始まり 7×6 円形セル + 月遷移）でログを表示し、過去日（今日含む）をクリックで 4 状態循環トグル（empty → complete → fail → skip → empty）できるようにする。これにより「先週月曜の記録忘れ」「3 週間前のスキップ修正」などの遅延入力を 1 画面で完結させる。

スコープ外:
- 複数タスクを 1 画面で同時表示（v1 は単一タスク `<select>`）
- 未来日への入力
- 頻度マッチしない日への入力（`isDueOn=false` 日は disabled）
- カレンダー上での頻度ルール編集（既存 `/tasks/$id` のまま）

**Goal:** `/calendar` ルートを新設し、選択中タスクの過去ログを月単位の 7×6 グリッド（日曜始まり、円形セル）で表示・編集できる画面を提供する。

**Architecture:** 既存 M9 履歴画面の遅延ロード経路（`loadTaskHistory`）を再利用しつつ、カレンダーは「表示中の月レンジ専用ローカルキャッシュ」を別途保持する。`state$.task_logs`（直近 31 日）とローカルキャッシュ（32 日以前の月分）を join し、書き込みは `setTaskLogStatus` で楽観更新後、ローカルキャッシュにも同期マージする（cutoff 外でも当該セッション中は安定して再描画される）。

**Tech Stack:** React 19, TanStack Router, legend-state v3 (`use$`), `@org/habit-core` (frequency / dates), `@org/habit-sync` (loadTaskHistory / setTaskLogStatus / refreshTaskStashView), vitest + @testing-library/react.

---

## File Structure 一覧

### 新規作成

| パス | 責務 |
|---|---|
| `packages/habit-core/src/month-grid.ts` | `addMonths` / `startOfMonth` / `endOfMonth` / `buildCalendarGrid` 純関数 |
| `packages/habit-core/src/month-grid.test.ts` | 上記の vitest テスト |
| `apps/habits/src/lib/calendar-status.ts` | `nextCalendarStatus(current)` 循環ロジック |
| `apps/habits/src/lib/calendar-status.test.ts` | 上記テスト |
| `apps/habits/src/lib/calendar-fetch-range.ts` | `loadTaskLogsInRange(client, opts)` ヘルパー |
| `apps/habits/src/lib/calendar-fetch-range.test.ts` | 上記テスト |
| `apps/habits/src/hooks/useTaskCalendar.ts` | 月切替＋ログ統合＋編集トグルを束ねるフック |
| `apps/habits/src/hooks/useTaskCalendar.test.tsx` | 上記テスト |
| `apps/habits/src/features/calendar/CalendarCell.tsx` | 1 セル（円形＋アイコン＋クリック） |
| `apps/habits/src/features/calendar/CalendarCell.test.tsx` | 上記テスト |
| `apps/habits/src/features/calendar/CalendarGrid.tsx` | 曜日見出し + 6×7 grid |
| `apps/habits/src/features/calendar/CalendarGrid.test.tsx` | 上記テスト |
| `apps/habits/src/features/calendar/CalendarHeader.tsx` | タスク select + 月ラベル + ← → ボタン |
| `apps/habits/src/features/calendar/CalendarHeader.test.tsx` | 上記テスト |
| `apps/habits/src/features/calendar/CalendarView.tsx` | トップ統合: useTaskCalendar + CalendarHeader + CalendarGrid |
| `apps/habits/src/features/calendar/CalendarView.test.tsx` | 上記テスト |
| `apps/habits/src/routes/calendar/CalendarPage.tsx` | `/calendar` ルート（ヘッダー + CalendarView） |
| `apps/habits/src/routes/calendar/CalendarPage.test.tsx` | 上記テスト |

### 修正

| パス | 修正内容 |
|---|---|
| `packages/habit-core/src/index.ts` | `addMonths` / `startOfMonth` / `endOfMonth` / `buildCalendarGrid` を re-export |
| `apps/habits/src/router.tsx` | `/calendar` ルートを `requireAuth` 付きで登録 |
| `apps/habits/src/App.test.tsx` | `/calendar` ルーティングテスト 1 件追加 |
| `apps/habits/src/features/today/Today.tsx` | nav に「カレンダー」を「履歴」の直前に追加 |
| `apps/habits/src/features/today/Today.test.tsx` | 「カレンダー」リンク表示テスト追加 |
| `packages/config-tailwind/src/theme.css` | カレンダーセル用配色トークンを追加 |
| `CLAUDE.md` | 「カレンダー画面」セクション追加 |

### データフロー

```
state$.task_logs (直近 31 日) ─┐
                                ├─→ joined logs (Map<YYYY-MM-DD, TaskLog>)
ローカル monthCache (taskId+month) ─┘     ↓
   ↑                              buildCalendarGrid(yearMonth) → 42 セル
   loadTaskLogsInRange             ↓     +
   → loadTaskHistory               isDueOn(rule, day, createdAt)
   (beforeDate=末日+1, limit=42)   ↓
                              CalendarGrid → CalendarCell × 42
                                   ↓
                            セルクリック (過去日のみ)
                                   ↓
                       nextCalendarStatus(current)
                                   ↓
                  setTaskLogStatus / clearTaskLogStatus
                       + monthCache を同期更新
                       + refreshTaskStashView()
```

---

## 設計上のトレードオフと選択理由

### A. 月レンジ取得は `loadTaskHistory` 流用（採択） vs 新規 `loadTaskLogsInMonth`（不採択）

**採択: loadTaskHistory 流用。** `apps/habits/src/lib/calendar-fetch-range.ts` でラップする。
- 既存テスト・型・エラー処理が固まっている
- クエリ `task_id = X AND date < Y ORDER BY date DESC LIMIT 42` で月レンジ（最大 42 セル）に十分
- 月初の `beforeDate` を「翌月 1 日」にすれば「< 翌月 1 日」≡「<= 月末」、grid の前月オーバーラップ最大 6 セルを `limit=42` で網羅可能
- `packages/habit-sync` への新規 API 追加を回避し変更面積を抑える

**最適化:** 表示月の月末が cutoff（today − 30 日）以降なら fetch をスキップし、`state$.task_logs` のみで描画する。

### B. カレンダーグリッドの配置先: `packages/habit-core/src/month-grid.ts`（採択） vs `apps/habits/src/lib/calendar-grid.ts`（不採択）

**採択: habit-core。**
- `addMonths` / `startOfMonth` / `endOfMonth` / `buildCalendarGrid` は純粋日付ロジック（`Date.UTC` 計算）
- 既存 `dates.ts` の `toUtcDays` / `isoDayOfWeek` と同じ性格
- 将来 Tauri ネイティブクライアントや年表示など他ビューで再利用される可能性が高い
- apps/habits 依存方向（apps → habit-core）に従う

### C. 過去日書込時のキャッシュ整合性

問題: 31 日 cutoff の外側に書き込むと、`setTaskLogStatus` は `state$.task_logs` にメモリ上の行を残すが、次回起動時に `setupSync` の cutoff filter で破棄される可能性がある。

**採択方針:**
1. **同セッション中の整合性は monthCache で保証**：書込時に state$ への楽観更新と並行して monthCache にも同じ行を merge（または delete）
2. **異なる端末からの過去日反映は v1 で割り切る**：Realtime filter は cutoff 内のみ通知。月ナビ ← → で同月を再描画する時に再 fetch される
3. **task_stash_view 整合性**：過去日書込で集計が変わるため、書込成功後に `refreshTaskStashView()` を必ず呼ぶ

### D. テーマトークン追加（採択）

`packages/config-tailwind/src/theme.css` に下記を追加し、`bg-cal-complete` のようなユーティリティ class を Tailwind v4 が自動生成する。

```css
--color-cal-complete: #4cc9f0;
--color-cal-fail: #ef4444;
--color-cal-skip: #9ca3af;
--color-cal-today: #facc15;
--color-cal-dim: #374151;
```

---

## テスト戦略

| 層 | テスト粒度 |
|---|---|
| 純関数（month-grid, calendar-status） | **厚い**: 境界値・閏年・年跨ぎ・全循環パターン |
| fetch ヘルパー（calendar-fetch-range） | **中**: 引数生成と範囲外フィルタを 2 件 |
| useTaskCalendar フック | **厚い**: 月切替時の fetch 発生、書込時のキャッシュ整合、isDueOn フィルタ、未来日禁止、ローディング状態 |
| プレゼンテーション（CalendarCell / Grid / Header） | **最低限**: aria 属性・data-testid によるレンダリング検証＋クリック発火 |
| CalendarView | **中**: tasks 空状態と通常時の描画 |
| CalendarPage | **薄い**: 見出し・戻りリンク・CalendarView 描画 |
| App ルーティング | **1 件**: 認証済 `/calendar` で見出し表示 |

---

## タスク分割（Phase A → F）

### Phase A: 日付グリッドユーティリティ（純関数）

#### Task 1: `addMonths` / `startOfMonth` / `endOfMonth` 追加

**Files:**
- Create: `packages/habit-core/src/month-grid.ts`
- Create: `packages/habit-core/src/month-grid.test.ts`

- [ ] **Step 1 (Red): 失敗するテスト作成**

`packages/habit-core/src/month-grid.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { addMonths, endOfMonth, startOfMonth } from './month-grid.js';

describe('month-grid.startOfMonth', () => {
  it('月初を返す', () => {
    expect(startOfMonth('2026-05-18')).toBe('2026-05-01');
  });
  it('既に月初ならそのまま', () => {
    expect(startOfMonth('2026-05-01')).toBe('2026-05-01');
  });
});

describe('month-grid.endOfMonth', () => {
  it('31 日月の月末', () => {
    expect(endOfMonth('2026-05-15')).toBe('2026-05-31');
  });
  it('30 日月の月末', () => {
    expect(endOfMonth('2026-04-10')).toBe('2026-04-30');
  });
  it('閏年 2 月の月末', () => {
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
  });
  it('非閏年 2 月の月末', () => {
    expect(endOfMonth('2025-02-10')).toBe('2025-02-28');
  });
});

describe('month-grid.addMonths', () => {
  it('+1 で翌月の月初に揃える', () => {
    expect(addMonths('2026-05-18', 1)).toBe('2026-06-01');
  });
  it('-1 で前月の月初に揃える', () => {
    expect(addMonths('2026-05-18', -1)).toBe('2026-04-01');
  });
  it('+12 で翌年同月の月初', () => {
    expect(addMonths('2026-05-18', 12)).toBe('2027-05-01');
  });
  it('-5 で年跨ぎ', () => {
    expect(addMonths('2026-03-15', -5)).toBe('2025-10-01');
  });
});
```

- [ ] **Step 2 (Run, expect FAIL):**

```bash
CI=true pnpm nx test habit-core -- --run src/month-grid.test.ts
```

Expected: モジュール解決失敗で FAIL。

- [ ] **Step 3 (Green): 実装**

`packages/habit-core/src/month-grid.ts`:

```ts
// 'YYYY-MM-DD' の月初を返す。
export function startOfMonth(yyyyMmDd: string): string {
  return `${yyyyMmDd.slice(0, 7)}-01`;
}

// 'YYYY-MM-DD' の月末を返す（Date.UTC は year, month=0..11, day=0 が前月末日）。
export function endOfMonth(yyyyMmDd: string): string {
  const [y, m] = yyyyMmDd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${yyyyMmDd.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

// 月加減算後の月初を返す（日成分は捨てる）。
export function addMonths(yyyyMmDd: string, n: number): string {
  const [y, m] = yyyyMmDd.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + n;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}-01`;
}
```

- [ ] **Step 4 (Run, expect PASS):**

```bash
CI=true pnpm nx test habit-core -- --run src/month-grid.test.ts
```

Expected: PASS（10 件）。

- [ ] **Step 5 (Commit):**

```bash
git add packages/habit-core/src/month-grid.ts packages/habit-core/src/month-grid.test.ts
git commit -m "feat(habit-core): add month boundary helpers (startOfMonth/endOfMonth/addMonths)"
```

---

#### Task 2: `buildCalendarGrid` 追加

**Files:**
- Modify: `packages/habit-core/src/month-grid.ts`
- Modify: `packages/habit-core/src/month-grid.test.ts`
- Modify: `packages/habit-core/src/index.ts`

- [ ] **Step 1 (Red): テスト追加**

`month-grid.test.ts` の末尾に追加:

```ts
import { buildCalendarGrid } from './month-grid.js';

describe('month-grid.buildCalendarGrid', () => {
  // 2026-05-01 は金曜（ISO 5）。日曜始まりなので前月から 5 セル必要。
  it('2026-05 を 42 セルで返す（日曜始まり）', () => {
    const cells = buildCalendarGrid('2026-05');
    expect(cells).toHaveLength(42);
    expect(cells[0]).toBe('2026-04-26'); // 日曜
    expect(cells[5]).toBe('2026-05-01'); // 金曜（月初）
    expect(cells[35]).toBe('2026-05-31'); // 月末
    expect(cells[41]).toBe('2026-06-06'); // 翌月オーバーラップ末
  });

  it('2026-02 (日曜始まり) は前月オーバーラップ 0 セル', () => {
    const cells = buildCalendarGrid('2026-02');
    expect(cells[0]).toBe('2026-02-01'); // 日曜
    expect(cells[27]).toBe('2026-02-28');
    expect(cells).toHaveLength(42);
  });

  it('閏年 2024-02 を 42 セルで返す', () => {
    const cells = buildCalendarGrid('2024-02');
    // 2024-02-01 は木曜 → 前月 4 セル
    expect(cells[0]).toBe('2024-01-28');
    expect(cells[3]).toBe('2024-01-31');
    expect(cells[4]).toBe('2024-02-01');
    expect(cells[32]).toBe('2024-02-29'); // 閏日
    expect(cells).toHaveLength(42);
  });

  it('全セルは連続した日付（差分 1 日）', () => {
    const cells = buildCalendarGrid('2026-05');
    for (let i = 1; i < cells.length; i++) {
      const prev = new Date(cells[i - 1]);
      const cur = new Date(cells[i]);
      expect(cur.getTime() - prev.getTime()).toBe(86_400_000);
    }
  });
});
```

- [ ] **Step 2 (Run, expect FAIL):**

```bash
CI=true pnpm nx test habit-core -- --run src/month-grid.test.ts
```

Expected: `buildCalendarGrid` 未エクスポート FAIL。

- [ ] **Step 3 (Green): 実装追加**

`month-grid.ts` に追加:

```ts
import { isoDayOfWeek } from './dates.js';

// 'YYYY-MM' を入力に取り、6 週 × 7 列 = 42 個の 'YYYY-MM-DD' 配列を返す。
// 日曜始まり。前月末日と翌月先頭日でオーバーラップを埋める。
export function buildCalendarGrid(yearMonth: string): string[] {
  const firstOfMonth = `${yearMonth}-01`;
  // 日曜始まりオフセット: 日=0, 月=1, ..., 土=6
  // isoDayOfWeek は 1=月..7=日 なので、日=7→0、他はそのまま
  const iso = isoDayOfWeek(firstOfMonth);
  const sundayOffset = iso === 7 ? 0 : iso;
  const [y, m] = firstOfMonth.split('-').map(Number);
  const startMs = Date.UTC(y, m - 1, 1 - sundayOffset);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startMs + i * 86_400_000);
    const yy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    cells.push(`${yy}-${mm}-${dd}`);
  }
  return cells;
}
```

- [ ] **Step 4 (Run, expect PASS):**

```bash
CI=true pnpm nx test habit-core -- --run src/month-grid.test.ts
```

- [ ] **Step 5: index.ts に re-export**

`packages/habit-core/src/index.ts` の `export { isoDayOfWeek, toUtcDays, weekOfMonth } from './dates.js';` の直下に追加:

```ts
export { addMonths, buildCalendarGrid, endOfMonth, startOfMonth } from './month-grid.js';
```

- [ ] **Step 6 (Verify all):**

```bash
CI=true pnpm nx test habit-core && pnpm exec biome ci packages/habit-core/src/month-grid.ts packages/habit-core/src/month-grid.test.ts packages/habit-core/src/index.ts
```

- [ ] **Step 7 (Commit):**

```bash
git add packages/habit-core/src/month-grid.ts packages/habit-core/src/month-grid.test.ts packages/habit-core/src/index.ts
git commit -m "feat(habit-core): add buildCalendarGrid (6x7 sunday-start grid)"
```

---

### Phase B: ステータストグル循環ロジック（純関数）

#### Task 3: `nextCalendarStatus` 追加

**Files:**
- Create: `apps/habits/src/lib/calendar-status.ts`
- Create: `apps/habits/src/lib/calendar-status.test.ts`

仕様: 4 状態循環 `empty → complete → fail → skip → empty`。戻り値 `null` は「empty に戻す（= clearTaskLogStatus）」を意味する。

- [ ] **Step 1 (Red):**

`apps/habits/src/lib/calendar-status.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextCalendarStatus } from './calendar-status.js';

describe('nextCalendarStatus', () => {
  it('empty → complete', () => {
    expect(nextCalendarStatus('empty')).toBe('complete');
  });
  it('complete → fail', () => {
    expect(nextCalendarStatus('complete')).toBe('fail');
  });
  it('fail → skip', () => {
    expect(nextCalendarStatus('fail')).toBe('skip');
  });
  it('skip → empty (null として返す)', () => {
    expect(nextCalendarStatus('skip')).toBeNull();
  });
});
```

- [ ] **Step 2 (Run, FAIL):**

```bash
CI=true pnpm nx test habits -- --run src/lib/calendar-status.test.ts
```

- [ ] **Step 3 (Green):**

`apps/habits/src/lib/calendar-status.ts`:

```ts
import type { DisplayTaskStatus, TaskStatus } from '@org/habit-sync';

// カレンダー画面でセルをクリックした時の次状態を返す。
// 戻り値 null は「empty に戻す（= clearTaskLogStatus を呼ぶ）」を意味する。
// 循環: empty → complete → fail → skip → empty
export function nextCalendarStatus(current: DisplayTaskStatus): TaskStatus | null {
  switch (current) {
    case 'empty':
      return 'complete';
    case 'complete':
      return 'fail';
    case 'fail':
      return 'skip';
    case 'skip':
      return null;
  }
}
```

- [ ] **Step 4 (Run, PASS):**

```bash
CI=true pnpm nx test habits -- --run src/lib/calendar-status.test.ts
```

Expected: PASS（4 件）。

- [ ] **Step 5 (Commit):**

```bash
git add apps/habits/src/lib/calendar-status.ts apps/habits/src/lib/calendar-status.test.ts
git commit -m "feat(habits): add nextCalendarStatus cycle (empty->complete->fail->skip->empty)"
```

---

### Phase C: 月レンジ fetch ヘルパー + useTaskCalendar フック

#### Task 4: `loadTaskLogsInRange` ヘルパー

**Files:**
- Create: `apps/habits/src/lib/calendar-fetch-range.ts`
- Create: `apps/habits/src/lib/calendar-fetch-range.test.ts`

- [ ] **Step 1 (Red):**

```ts
import { describe, expect, it, vi } from 'vitest';

const loadTaskHistoryMock = vi.fn();
vi.mock('@org/habit-sync', () => ({
  loadTaskHistory: (...args: unknown[]): unknown => loadTaskHistoryMock(...args),
}));

import { loadTaskLogsInRange } from './calendar-fetch-range.js';

describe('loadTaskLogsInRange', () => {
  it('grid 全期間を beforeDate=最終日+1, limit=42 で取得', async () => {
    loadTaskHistoryMock.mockResolvedValueOnce([
      { task_id: 't1', date: '2026-04-30', status: 'complete' },
    ]);
    const client = {} as unknown;
    const rows = await loadTaskLogsInRange(client, {
      taskId: 't1',
      firstDay: '2026-04-26',
      lastDay: '2026-06-06',
    });
    expect(loadTaskHistoryMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ taskId: 't1', beforeDate: '2026-06-07', limit: 42 }),
    );
    expect(rows).toHaveLength(1);
  });

  it('firstDay より前の行は除外', async () => {
    loadTaskHistoryMock.mockResolvedValueOnce([
      { task_id: 't1', date: '2026-04-30', status: 'complete' },
      { task_id: 't1', date: '2026-04-25', status: 'fail' }, // 範囲外
    ]);
    const rows = await loadTaskLogsInRange({} as unknown, {
      taskId: 't1',
      firstDay: '2026-04-26',
      lastDay: '2026-06-06',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-04-30');
  });
});
```

- [ ] **Step 2 (Run, FAIL):**

```bash
CI=true pnpm nx test habits -- --run src/lib/calendar-fetch-range.test.ts
```

- [ ] **Step 3 (Green):**

`apps/habits/src/lib/calendar-fetch-range.ts`:

```ts
import { loadTaskHistory, type TaskLog } from '@org/habit-sync';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface LoadTaskLogsInRangeOptions {
  taskId: string;
  firstDay: string; // 'YYYY-MM-DD' grid の先頭日（含む）
  lastDay: string; // 'YYYY-MM-DD' grid の末尾日（含む）
}

// grid 全期間（最大 42 日）の log を 1 リクエストで取得。
// loadTaskHistory は `date < beforeDate` 条件なので「翌日」を渡す。
// 取得後、firstDay より前の行はフィルタで除外する。
export async function loadTaskLogsInRange(
  client: SupabaseClient,
  opts: LoadTaskLogsInRangeOptions,
): Promise<TaskLog[]> {
  const [y, m, d] = opts.lastDay.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const beforeDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  const rows = await loadTaskHistory(client, {
    taskId: opts.taskId,
    beforeDate,
    limit: 42,
  });
  return rows.filter((r) => r.date >= opts.firstDay);
}
```

- [ ] **Step 4 (Run, PASS):**

```bash
CI=true pnpm nx test habits -- --run src/lib/calendar-fetch-range.test.ts
```

- [ ] **Step 5 (Commit):**

```bash
git add apps/habits/src/lib/calendar-fetch-range.ts apps/habits/src/lib/calendar-fetch-range.test.ts
git commit -m "feat(habits): add loadTaskLogsInRange helper for month-grid fetch"
```

---

#### Task 5: `useTaskCalendar` フック

**Files:**
- Create: `apps/habits/src/hooks/useTaskCalendar.ts`
- Create: `apps/habits/src/hooks/useTaskCalendar.test.tsx`

戻り値型:

```ts
interface CalendarCellModel {
  date: string;             // 'YYYY-MM-DD'
  isCurrentMonth: boolean;  // 表示中の月か（前後月オーバーラップは false）
  isDue: boolean;           // 頻度マッチ
  isFuture: boolean;        // 今日より未来
  isToday: boolean;
  status: DisplayTaskStatus;
}

interface UseTaskCalendarResult {
  yearMonth: string;        // 'YYYY-MM'
  cells: CalendarCellModel[]; // 42 件
  isLoading: boolean;
  goPrevMonth: () => void;
  goNextMonth: () => void;
  toggleCell: (date: string) => Promise<void>;
}
```

- [ ] **Step 1 (Red):**

`apps/habits/src/hooks/useTaskCalendar.test.tsx`:

```tsx
import type { Task, TaskLog } from '@org/habit-sync';
import { state$ } from '@org/habit-sync';
import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadTaskHistoryMock = vi.fn();
const setTaskLogStatusMock = vi.fn();
const clearTaskLogStatusMock = vi.fn();
const refreshTaskStashViewMock = vi.fn();
vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    loadTaskHistory: (...args: unknown[]): unknown => loadTaskHistoryMock(...args),
    setTaskLogStatus: (...args: unknown[]): unknown => setTaskLogStatusMock(...args),
    clearTaskLogStatus: (...args: unknown[]): unknown => clearTaskLogStatusMock(...args),
    refreshTaskStashView: (...args: unknown[]): unknown => refreshTaskStashViewMock(...args),
  };
});
vi.mock('../lib/supabase.js', () => ({ getAppSupabase: (): unknown => ({}) }));

import { useTaskCalendar } from './useTaskCalendar.js';

const NOW = '2026-05-18T00:00:00Z';
function mkTask(id: string, freq: unknown, createdAt = NOW): Task {
  return {
    id,
    user_id: 'u',
    time_slot_id: 's1',
    name: 'T',
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    frequency: freq as any,
    sort_order: 0,
    archived_at: null,
    created_at: createdAt,
    updated_at: NOW,
  };
}
function mkLog(taskId: string, date: string, status: 'complete' | 'fail' | 'skip'): TaskLog {
  return { task_id: taskId, date, status, created_at: NOW, updated_at: NOW };
}

interface ProbeProps {
  taskId: string | null;
  today: string;
}
function Probe({ taskId, today }: ProbeProps): React.ReactElement {
  const { yearMonth, cells, toggleCell, goPrevMonth, goNextMonth } = useTaskCalendar(
    taskId,
    today,
  );
  return (
    <div>
      <span data-testid="ym">{yearMonth}</span>
      <ul>
        {cells.map((c) => (
          <li
            key={c.date}
            data-testid="cell"
            data-date={c.date}
            data-status={c.status}
            data-due={c.isDue ? '1' : '0'}
            data-future={c.isFuture ? '1' : '0'}
            data-current={c.isCurrentMonth ? '1' : '0'}
          >
            {c.date}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          void toggleCell('2026-05-10');
        }}
      >
        toggle10
      </button>
      <button type="button" onClick={goPrevMonth}>
        prev
      </button>
      <button type="button" onClick={goNextMonth}>
        next
      </button>
    </div>
  );
}

beforeEach(() => {
  loadTaskHistoryMock.mockReset();
  setTaskLogStatusMock.mockReset();
  clearTaskLogStatusMock.mockReset();
  refreshTaskStashViewMock.mockReset();
  state$.tasks.set({});
  state$.task_logs.set({});
});
afterEach(() => {
  state$.tasks.set({});
  state$.task_logs.set({});
});

describe('useTaskCalendar', () => {
  it('today の年月を初期表示し、42 セル返す', () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    render(<Probe taskId="a" today="2026-05-18" />);
    expect(screen.getByTestId('ym')).toHaveTextContent('2026-05');
    expect(screen.getAllByTestId('cell')).toHaveLength(42);
  });

  it('isDueOn=false の日は isDue=0', () => {
    // weekday=月,水,金 (1,3,5) のみ
    state$.tasks.assign({
      a: mkTask('a', { type: 'weekday', days: [1, 3, 5] }, '2026-01-01'),
    });
    render(<Probe taskId="a" today="2026-05-18" />);
    const cells = screen.getAllByTestId('cell');
    // 2026-05-10 は日曜 → false
    const sun = cells.find((c) => c.getAttribute('data-date') === '2026-05-10');
    expect(sun?.getAttribute('data-due')).toBe('0');
    // 2026-05-11 は月曜 → true
    const mon = cells.find((c) => c.getAttribute('data-date') === '2026-05-11');
    expect(mon?.getAttribute('data-due')).toBe('1');
  });

  it('未来日は isFuture=1', () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    render(<Probe taskId="a" today="2026-05-18" />);
    const cells = screen.getAllByTestId('cell');
    const future = cells.find((c) => c.getAttribute('data-date') === '2026-05-19');
    expect(future?.getAttribute('data-future')).toBe('1');
    const today = cells.find((c) => c.getAttribute('data-date') === '2026-05-18');
    expect(today?.getAttribute('data-future')).toBe('0');
  });

  it('state$.task_logs の status を反映する', () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    state$.task_logs.assign({
      'a-2026-05-10': mkLog('a', '2026-05-10', 'complete'),
      'a-2026-05-11': mkLog('a', '2026-05-11', 'fail'),
    });
    render(<Probe taskId="a" today="2026-05-18" />);
    const cells = screen.getAllByTestId('cell');
    expect(
      cells.find((c) => c.getAttribute('data-date') === '2026-05-10')?.getAttribute('data-status'),
    ).toBe('complete');
    expect(
      cells.find((c) => c.getAttribute('data-date') === '2026-05-11')?.getAttribute('data-status'),
    ).toBe('fail');
    expect(
      cells.find((c) => c.getAttribute('data-date') === '2026-05-12')?.getAttribute('data-status'),
    ).toBe('empty');
  });

  it('toggleCell は empty→complete で setTaskLogStatus("complete") を呼ぶ', async () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    render(<Probe taskId="a" today="2026-05-18" />);
    await act(async () => {
      screen.getByRole('button', { name: 'toggle10' }).click();
    });
    expect(setTaskLogStatusMock).toHaveBeenCalledWith('a', '2026-05-10', 'complete');
    expect(refreshTaskStashViewMock).toHaveBeenCalled();
  });

  it('toggleCell は skip → empty (clearTaskLogStatus) を呼ぶ', async () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    state$.task_logs.assign({
      'a-2026-05-10': mkLog('a', '2026-05-10', 'skip'),
    });
    render(<Probe taskId="a" today="2026-05-18" />);
    await act(async () => {
      screen.getByRole('button', { name: 'toggle10' }).click();
    });
    expect(clearTaskLogStatusMock).toHaveBeenCalledWith('a', '2026-05-10');
  });

  it('未来日のトグルは何もしない', async () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    function ProbeFuture(): React.ReactElement {
      const { toggleCell } = useTaskCalendar('a', '2026-05-09');
      return (
        <button
          type="button"
          onClick={() => {
            void toggleCell('2026-05-10');
          }}
        >
          t
        </button>
      );
    }
    render(<ProbeFuture />);
    await act(async () => {
      screen.getByRole('button', { name: 't' }).click();
    });
    expect(setTaskLogStatusMock).not.toHaveBeenCalled();
    expect(clearTaskLogStatusMock).not.toHaveBeenCalled();
  });

  it('isDue=false 日のトグルは何もしない', async () => {
    state$.tasks.assign({
      a: mkTask('a', { type: 'weekday', days: [2] }, '2026-01-01'), // 火曜のみ
    });
    render(<Probe taskId="a" today="2026-05-18" />);
    // 2026-05-10 は日曜 → not due
    await act(async () => {
      screen.getByRole('button', { name: 'toggle10' }).click();
    });
    expect(setTaskLogStatusMock).not.toHaveBeenCalled();
  });

  it('goPrevMonth で表示年月が前月になる', () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    render(<Probe taskId="a" today="2026-05-18" />);
    act(() => {
      screen.getByRole('button', { name: 'prev' }).click();
    });
    expect(screen.getByTestId('ym')).toHaveTextContent('2026-04');
  });

  it('cutoff より古い月への切替で loadTaskHistory を呼ぶ', async () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }, '2025-01-01') });
    loadTaskHistoryMock.mockResolvedValueOnce([mkLog('a', '2026-01-15', 'complete')]);
    render(<Probe taskId="a" today="2026-05-18" />);
    // 4 月前へ移動: 2026-01
    await act(async () => {
      screen.getByRole('button', { name: 'prev' }).click();
      screen.getByRole('button', { name: 'prev' }).click();
      screen.getByRole('button', { name: 'prev' }).click();
      screen.getByRole('button', { name: 'prev' }).click();
    });
    expect(loadTaskHistoryMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 (Run, FAIL):**

```bash
CI=true pnpm nx test habits -- --run src/hooks/useTaskCalendar.test.tsx
```

- [ ] **Step 3 (Green): 実装**

`apps/habits/src/hooks/useTaskCalendar.ts`:

```ts
import { use$ } from '@legendapp/state/react';
import { buildCalendarGrid, type Frequency, isDueOn, toUtcDays } from '@org/habit-core';
import {
  clearTaskLogStatus,
  type DisplayTaskStatus,
  getTaskLogsCutoffDate,
  refreshTaskStashView,
  setTaskLogStatus,
  state$,
  type Task,
  type TaskLog,
} from '@org/habit-sync';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadTaskLogsInRange } from '../lib/calendar-fetch-range.js';
import { nextCalendarStatus } from '../lib/calendar-status.js';
import { getAppSupabase } from '../lib/supabase.js';

export interface CalendarCellModel {
  date: string;
  isCurrentMonth: boolean;
  isDue: boolean;
  isFuture: boolean;
  isToday: boolean;
  status: DisplayTaskStatus;
}

export interface UseTaskCalendarResult {
  yearMonth: string;
  cells: CalendarCellModel[];
  isLoading: boolean;
  goPrevMonth: () => void;
  goNextMonth: () => void;
  toggleCell: (date: string) => Promise<void>;
}

function addMonthsYm(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`;
}

export function useTaskCalendar(
  taskId: string | null,
  today: string,
): UseTaskCalendarResult {
  const [yearMonth, setYearMonth] = useState<string>(today.slice(0, 7));
  // 月ローカルキャッシュ: key=`${taskId}-${yearMonth}` → Map<date, TaskLog>
  const [cache, setCache] = useState<Map<string, Map<string, TaskLog>>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const task = use$<Task | undefined>(() => {
    if (taskId === null) {
      return undefined;
    }
    return (state$.tasks.get() as Record<string, Task>)[taskId];
  });

  const recentLogs = use$<Record<string, TaskLog>>(() => {
    if (taskId === null) {
      return {};
    }
    const all = Object.values(state$.task_logs.get()) as TaskLog[];
    const map: Record<string, TaskLog> = {};
    for (const lg of all) {
      if (lg.task_id === taskId) {
        map[lg.date] = lg;
      }
    }
    return map;
  });

  const grid = useMemo(() => buildCalendarGrid(yearMonth), [yearMonth]);
  const firstDay = grid[0];
  const lastDay = grid[grid.length - 1];

  // 月切替時の遅延 fetch: 月末が cutoff より古い場合のみ
  useEffect(() => {
    if (taskId === null || task === undefined) {
      return;
    }
    const cutoff = getTaskLogsCutoffDate(today);
    if (lastDay >= cutoff) {
      return; // state$ 経由でカバーされている
    }
    const cacheKey = `${taskId}-${yearMonth}`;
    if (cache.has(cacheKey)) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const rows = await loadTaskLogsInRange(getAppSupabase(), {
          taskId,
          firstDay,
          lastDay,
        });
        if (cancelled) {
          return;
        }
        const byDate = new Map<string, TaskLog>();
        for (const r of rows) {
          byDate.set(r.date, r);
        }
        setCache((prev) => {
          const next = new Map(prev);
          next.set(cacheKey, byDate);
          return next;
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskId, task, yearMonth, firstDay, lastDay, today, cache]);

  const cells: CalendarCellModel[] = useMemo(() => {
    const todayDays = toUtcDays(today);
    const cacheKey = taskId === null ? '' : `${taskId}-${yearMonth}`;
    const cached = cache.get(cacheKey);
    return grid.map((date) => {
      let status: DisplayTaskStatus = 'empty';
      const fromRecent = recentLogs[date];
      if (fromRecent !== undefined) {
        status = fromRecent.status;
      } else if (cached !== undefined && cached.has(date)) {
        const lg = cached.get(date);
        if (lg !== undefined) {
          status = lg.status;
        }
      }
      const dueHere =
        task !== undefined &&
        isDueOn(task.frequency as unknown as Frequency, date, task.created_at);
      return {
        date,
        isCurrentMonth: date.slice(0, 7) === yearMonth,
        isDue: dueHere,
        isFuture: toUtcDays(date) > todayDays,
        isToday: date === today,
        status,
      };
    });
  }, [grid, recentLogs, cache, yearMonth, taskId, task, today]);

  const goPrevMonth = useCallback(() => {
    setYearMonth((cur) => addMonthsYm(cur, -1));
  }, []);
  const goNextMonth = useCallback(() => {
    setYearMonth((cur) => addMonthsYm(cur, 1));
  }, []);

  const toggleCell = useCallback(
    async (date: string): Promise<void> => {
      if (taskId === null || task === undefined) {
        return;
      }
      // 未来日禁止
      if (toUtcDays(date) > toUtcDays(today)) {
        return;
      }
      // 頻度外禁止
      if (!isDueOn(task.frequency as unknown as Frequency, date, task.created_at)) {
        return;
      }
      const cur = cells.find((c) => c.date === date);
      if (cur === undefined) {
        return;
      }
      const next = nextCalendarStatus(cur.status);
      if (next === null) {
        clearTaskLogStatus(taskId, date);
        setCache((prev) => {
          const key = `${taskId}-${date.slice(0, 7)}`;
          const m = prev.get(key);
          if (m === undefined) {
            return prev;
          }
          const nm = new Map(m);
          nm.delete(date);
          const np = new Map(prev);
          np.set(key, nm);
          return np;
        });
      } else {
        setTaskLogStatus(taskId, date, next);
        setCache((prev) => {
          const key = `${taskId}-${date.slice(0, 7)}`;
          const m = prev.get(key) ?? new Map<string, TaskLog>();
          const nm = new Map(m);
          const nowIso = new Date().toISOString();
          nm.set(date, {
            task_id: taskId,
            date,
            status: next,
            created_at: nowIso,
            updated_at: nowIso,
          });
          const np = new Map(prev);
          np.set(key, nm);
          return np;
        });
      }
      await refreshTaskStashView();
    },
    [taskId, task, today, cells],
  );

  // taskId 切替時にキャッシュをクリア
  useEffect(() => {
    setCache(new Map());
  }, [taskId]);

  return { yearMonth, cells, isLoading, goPrevMonth, goNextMonth, toggleCell };
}
```

- [ ] **Step 4 (Run, PASS):**

```bash
CI=true pnpm nx test habits -- --run src/hooks/useTaskCalendar.test.tsx
```

Expected: PASS（10 件）。

- [ ] **Step 5 (Commit):**

```bash
git add apps/habits/src/hooks/useTaskCalendar.ts apps/habits/src/hooks/useTaskCalendar.test.tsx
git commit -m "feat(habits): add useTaskCalendar hook (month nav + log merge + cycle toggle)"
```

---

### Phase D: プレゼンテーション系コンポーネント

#### Task 6: テーマトークン追加

**Files:**
- Modify: `packages/config-tailwind/src/theme.css`

- [ ] **Step 1: 直接追加**

`packages/config-tailwind/src/theme.css` 末尾の `}` 直前に追記:

```css
  --color-cal-complete: #4cc9f0;
  --color-cal-fail: #ef4444;
  --color-cal-skip: #9ca3af;
  --color-cal-today: #facc15;
  --color-cal-dim: #374151;
```

- [ ] **Step 2 (Commit):**

```bash
git add packages/config-tailwind/src/theme.css
git commit -m "feat(config-tailwind): add calendar cell color tokens"
```

> theme.css は v4 CSS-first で TS テストの対象外。手動確認のみ。

---

#### Task 7: `CalendarCell` コンポーネント

**Files:**
- Create: `apps/habits/src/features/calendar/CalendarCell.tsx`
- Create: `apps/habits/src/features/calendar/CalendarCell.test.tsx`

- [ ] **Step 1 (Red):**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarCell } from './CalendarCell.js';

describe('CalendarCell', () => {
  it('日付の日成分を表示する', () => {
    render(
      <CalendarCell
        date="2026-05-15"
        isCurrentMonth
        isDue
        isFuture={false}
        isToday={false}
        status="empty"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('15');
  });

  it('complete 状態で aria-label に「完了」を含む', () => {
    render(
      <CalendarCell
        date="2026-05-15"
        isCurrentMonth
        isDue
        isFuture={false}
        isToday={false}
        status="complete"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('完了'),
    );
  });

  it('isDue=false なら disabled', () => {
    render(
      <CalendarCell
        date="2026-05-15"
        isCurrentMonth
        isDue={false}
        isFuture={false}
        isToday={false}
        status="empty"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('isFuture=true なら disabled', () => {
    render(
      <CalendarCell
        date="2026-05-30"
        isCurrentMonth
        isDue
        isFuture
        isToday={false}
        status="empty"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('クリックで onClick(date) を呼ぶ', () => {
    const onClick = vi.fn();
    render(
      <CalendarCell
        date="2026-05-15"
        isCurrentMonth
        isDue
        isFuture={false}
        isToday={false}
        status="empty"
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('2026-05-15');
  });

  it('isToday=true は data-today="1"', () => {
    render(
      <CalendarCell
        date="2026-05-18"
        isCurrentMonth
        isDue
        isFuture={false}
        isToday
        status="empty"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('data-today', '1');
  });
});
```

- [ ] **Step 2 (Run, FAIL):**

```bash
CI=true pnpm nx test habits -- --run src/features/calendar/CalendarCell.test.tsx
```

- [ ] **Step 3 (Green):**

`apps/habits/src/features/calendar/CalendarCell.tsx`:

```tsx
import type { DisplayTaskStatus } from '@org/habit-sync';
import type React from 'react';

export interface CalendarCellProps {
  date: string;
  isCurrentMonth: boolean;
  isDue: boolean;
  isFuture: boolean;
  isToday: boolean;
  status: DisplayTaskStatus;
  onClick: (date: string) => void;
}

const STATUS_LABEL: Record<DisplayTaskStatus, string> = {
  empty: '未設定',
  complete: '完了',
  fail: '失敗',
  skip: 'スキップ',
};

function statusClass(s: DisplayTaskStatus, dim: boolean): string {
  if (dim) {
    return 'text-cal-dim';
  }
  switch (s) {
    case 'complete':
      return 'bg-cal-complete text-white';
    case 'fail':
      return 'text-cal-fail';
    case 'skip':
      return 'text-cal-skip';
    case 'empty':
      return 'text-game-fg';
  }
}

export function CalendarCell({
  date,
  isCurrentMonth,
  isDue,
  isFuture,
  isToday,
  status,
  onClick,
}: CalendarCellProps): React.ReactElement {
  const day = Number.parseInt(date.slice(8, 10), 10);
  const disabled = !isDue || isFuture;
  const dim = !isCurrentMonth || !isDue;
  const todayRing = isToday ? 'ring-2 ring-cal-today' : '';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(date)}
      data-testid="cal-cell"
      data-date={date}
      data-today={isToday ? '1' : '0'}
      aria-label={`${date} ${STATUS_LABEL[status]}`}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm ${statusClass(status, dim)} ${todayRing} disabled:cursor-not-allowed`}
    >
      {status === 'fail' ? '×' : status === 'skip' ? '–' : day}
    </button>
  );
}
```

> 注: skip 記号は en-dash (`–`)、fail は U+00D7 (`×`)。アイコン画像にする場合は将来差し替え。

- [ ] **Step 4 (Run, PASS):**

```bash
CI=true pnpm nx test habits -- --run src/features/calendar/CalendarCell.test.tsx
```

- [ ] **Step 5 (Commit):**

```bash
git add apps/habits/src/features/calendar/CalendarCell.tsx apps/habits/src/features/calendar/CalendarCell.test.tsx
git commit -m "feat(habits): add CalendarCell with status-aware circular button"
```

---

#### Task 8: `CalendarGrid` コンポーネント

**Files:**
- Create: `apps/habits/src/features/calendar/CalendarGrid.tsx`
- Create: `apps/habits/src/features/calendar/CalendarGrid.test.tsx`

- [ ] **Step 1 (Red):**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarCellModel } from '../../hooks/useTaskCalendar.js';
import { CalendarGrid } from './CalendarGrid.js';

function mkCells(): CalendarCellModel[] {
  const cells: CalendarCellModel[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      isCurrentMonth: true,
      isDue: true,
      isFuture: false,
      isToday: false,
      status: 'empty',
    });
  }
  return cells;
}

describe('CalendarGrid', () => {
  it('曜日見出しを日曜始まりで表示', () => {
    render(<CalendarGrid cells={mkCells()} onCellClick={vi.fn()} />);
    const heads = screen.getAllByTestId('weekday-head');
    expect(heads.map((h) => h.textContent)).toEqual(['日', '月', '火', '水', '木', '金', '土']);
  });

  it('42 個のセルを描画する', () => {
    render(<CalendarGrid cells={mkCells()} onCellClick={vi.fn()} />);
    expect(screen.getAllByTestId('cal-cell')).toHaveLength(42);
  });
});
```

- [ ] **Step 2 (Run, FAIL):**

```bash
CI=true pnpm nx test habits -- --run src/features/calendar/CalendarGrid.test.tsx
```

- [ ] **Step 3 (Green):**

`apps/habits/src/features/calendar/CalendarGrid.tsx`:

```tsx
import type React from 'react';
import type { CalendarCellModel } from '../../hooks/useTaskCalendar.js';
import { CalendarCell } from './CalendarCell.js';

export interface CalendarGridProps {
  cells: CalendarCellModel[];
  onCellClick: (date: string) => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function CalendarGrid({ cells, onCellClick }: CalendarGridProps): React.ReactElement {
  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAYS.map((w) => (
        <div key={w} data-testid="weekday-head" className="text-center text-xs text-gray-400">
          {w}
        </div>
      ))}
      {cells.map((c) => (
        <div key={c.date} className="flex justify-center">
          <CalendarCell
            date={c.date}
            isCurrentMonth={c.isCurrentMonth}
            isDue={c.isDue}
            isFuture={c.isFuture}
            isToday={c.isToday}
            status={c.status}
            onClick={onCellClick}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4 (Run, PASS):**

```bash
CI=true pnpm nx test habits -- --run src/features/calendar/CalendarGrid.test.tsx
```

- [ ] **Step 5 (Commit):**

```bash
git add apps/habits/src/features/calendar/CalendarGrid.tsx apps/habits/src/features/calendar/CalendarGrid.test.tsx
git commit -m "feat(habits): add CalendarGrid (sunday-start 7x6 layout)"
```

---

#### Task 9: `CalendarHeader` コンポーネント

**Files:**
- Create: `apps/habits/src/features/calendar/CalendarHeader.tsx`
- Create: `apps/habits/src/features/calendar/CalendarHeader.test.tsx`

- [ ] **Step 1 (Red):**

```tsx
import type { Task } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarHeader } from './CalendarHeader.js';

const NOW = '2026-05-18T00:00:00Z';
function mkTask(id: string, name: string): Task {
  return {
    id,
    user_id: 'u',
    time_slot_id: 's1',
    name,
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    frequency: { type: 'daily' } as any,
    sort_order: 0,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

describe('CalendarHeader', () => {
  it('年月ラベルを表示（YYYY 年 M 月）', () => {
    render(
      <CalendarHeader
        tasks={[]}
        selectedId={null}
        onSelectTask={vi.fn()}
        yearMonth="2026-05"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    expect(screen.getByTestId('cal-month-label')).toHaveTextContent('2026 年 5 月');
  });

  it('← ボタンで onPrevMonth、→ で onNextMonth', () => {
    const prev = vi.fn();
    const next = vi.fn();
    render(
      <CalendarHeader
        tasks={[]}
        selectedId={null}
        onSelectTask={vi.fn()}
        yearMonth="2026-05"
        onPrevMonth={prev}
        onNextMonth={next}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '前月' }));
    expect(prev).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '次月' }));
    expect(next).toHaveBeenCalled();
  });

  it('タスク select 変更で onSelectTask(id)', () => {
    const onSel = vi.fn();
    render(
      <CalendarHeader
        tasks={[mkTask('a', 'A'), mkTask('b', 'B')]}
        selectedId="a"
        onSelectTask={onSel}
        yearMonth="2026-05"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'タスク選択' }), {
      target: { value: 'b' },
    });
    expect(onSel).toHaveBeenCalledWith('b');
  });
});
```

- [ ] **Step 2 (Run, FAIL):**

```bash
CI=true pnpm nx test habits -- --run src/features/calendar/CalendarHeader.test.tsx
```

- [ ] **Step 3 (Green):**

`apps/habits/src/features/calendar/CalendarHeader.tsx`:

```tsx
import type { Task } from '@org/habit-sync';
import type React from 'react';

export interface CalendarHeaderProps {
  tasks: Task[];
  selectedId: string | null;
  onSelectTask: (id: string) => void;
  yearMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${y} 年 ${m} 月`;
}

export function CalendarHeader(props: CalendarHeaderProps): React.ReactElement {
  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-400">タスク選択</span>
        <select
          aria-label="タスク選択"
          className="rounded border border-gray-500 bg-transparent px-2 py-1"
          value={props.selectedId ?? ''}
          onChange={(e) => props.onSelectTask(e.target.value)}
        >
          {props.tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="前月"
          onClick={props.onPrevMonth}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          ←
        </button>
        <span data-testid="cal-month-label" className="text-lg font-semibold">
          {formatYearMonth(props.yearMonth)}
        </span>
        <button
          type="button"
          aria-label="次月"
          onClick={props.onNextMonth}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 (Run, PASS):**

```bash
CI=true pnpm nx test habits -- --run src/features/calendar/CalendarHeader.test.tsx
```

- [ ] **Step 5 (Commit):**

```bash
git add apps/habits/src/features/calendar/CalendarHeader.tsx apps/habits/src/features/calendar/CalendarHeader.test.tsx
git commit -m "feat(habits): add CalendarHeader with task select and month nav"
```

---

#### Task 10: `CalendarView` 統合コンポーネント

**Files:**
- Create: `apps/habits/src/features/calendar/CalendarView.tsx`
- Create: `apps/habits/src/features/calendar/CalendarView.test.tsx`

- [ ] **Step 1 (Red):**

```tsx
import { state$, type Task } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    loadTaskHistory: vi.fn(),
    setTaskLogStatus: vi.fn(),
    clearTaskLogStatus: vi.fn(),
    refreshTaskStashView: vi.fn(),
  };
});
vi.mock('../../lib/supabase.js', () => ({ getAppSupabase: (): unknown => ({}) }));
vi.mock('../../lib/today-date.js', () => ({ getTodayDateString: (): string => '2026-05-18' }));

import { CalendarView } from './CalendarView.js';

const NOW = '2026-05-18T00:00:00Z';
function mkTask(id: string, name: string): Task {
  return {
    id,
    user_id: 'u',
    time_slot_id: 's1',
    name,
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    frequency: { type: 'daily' } as any,
    sort_order: 0,
    archived_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: NOW,
  };
}

beforeEach(() => {
  state$.tasks.set({});
  state$.task_logs.set({});
});
afterEach(() => {
  state$.tasks.set({});
  state$.task_logs.set({});
});

describe('CalendarView', () => {
  it('タスクが無いとき空状態メッセージ', () => {
    render(<CalendarView />);
    expect(screen.getByText(/タスクが登録されていません/)).toBeInTheDocument();
  });

  it('タスクがあると CalendarHeader + CalendarGrid を描画', () => {
    state$.tasks.assign({ a: mkTask('a', 'A') });
    render(<CalendarView />);
    expect(screen.getByRole('combobox', { name: 'タスク選択' })).toBeInTheDocument();
    expect(screen.getAllByTestId('cal-cell')).toHaveLength(42);
  });
});
```

- [ ] **Step 2 (Run, FAIL):**

```bash
CI=true pnpm nx test habits -- --run src/features/calendar/CalendarView.test.tsx
```

- [ ] **Step 3 (Green):**

`apps/habits/src/features/calendar/CalendarView.tsx`:

```tsx
import { use$ } from '@legendapp/state/react';
import { state$, type Task } from '@org/habit-sync';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useTaskCalendar } from '../../hooks/useTaskCalendar.js';
import { getTodayDateString } from '../../lib/today-date.js';
import { CalendarGrid } from './CalendarGrid.js';
import { CalendarHeader } from './CalendarHeader.js';

function useAllTasksForCalendar(): Task[] {
  return use$(() => {
    const list = Object.values(state$.tasks.get()) as Task[];
    return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  });
}

export function CalendarView(): React.ReactElement {
  const tasks = useAllTasksForCalendar();
  const today = getTodayDateString();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedId === null && tasks.length > 0) {
      setSelectedId(tasks[0].id);
    }
  }, [tasks, selectedId]);

  const { yearMonth, cells, goPrevMonth, goNextMonth, toggleCell } = useTaskCalendar(
    selectedId,
    today,
  );

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        タスクが登録されていません。先にタスクを追加してください。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <CalendarHeader
        tasks={tasks}
        selectedId={selectedId}
        onSelectTask={setSelectedId}
        yearMonth={yearMonth}
        onPrevMonth={goPrevMonth}
        onNextMonth={goNextMonth}
      />
      <CalendarGrid
        cells={cells}
        onCellClick={(d) => {
          void toggleCell(d);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4 (Run, PASS):**

```bash
CI=true pnpm nx test habits -- --run src/features/calendar/CalendarView.test.tsx
```

- [ ] **Step 5 (Commit):**

```bash
git add apps/habits/src/features/calendar/CalendarView.tsx apps/habits/src/features/calendar/CalendarView.test.tsx
git commit -m "feat(habits): add CalendarView wiring header/grid with useTaskCalendar"
```

---

### Phase E: ルート登録 + ナビ追加

#### Task 11: `CalendarPage` ルートページ

**Files:**
- Create: `apps/habits/src/routes/calendar/CalendarPage.tsx`
- Create: `apps/habits/src/routes/calendar/CalendarPage.test.tsx`

- [ ] **Step 1 (Red):**

```tsx
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}));
vi.mock('../../features/calendar/CalendarView.js', () => ({
  CalendarView: () => <div data-testid="calendar-view" />,
}));

import { CalendarPage } from './CalendarPage.js';

describe('CalendarPage', () => {
  it('「カレンダー」見出しを表示する', () => {
    render(<CalendarPage />);
    expect(screen.getByRole('heading', { name: 'カレンダー' })).toBeInTheDocument();
  });
  it('今日のタスクへ戻るリンク', () => {
    render(<CalendarPage />);
    expect(screen.getByRole('link', { name: '今日のタスク' })).toHaveAttribute('href', '/today');
  });
  it('CalendarView を描画', () => {
    render(<CalendarPage />);
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 (Run, FAIL):**

```bash
CI=true pnpm nx test habits -- --run src/routes/calendar/CalendarPage.test.tsx
```

- [ ] **Step 3 (Green):**

`apps/habits/src/routes/calendar/CalendarPage.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import type React from 'react';
import { CalendarView } from '../../features/calendar/CalendarView.js';

export function CalendarPage(): React.ReactElement {
  return (
    <section className="mx-auto max-w-2xl p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-game-accent">カレンダー</h1>
        <nav className="flex items-center gap-2">
          <Link to="/today" className="rounded border border-gray-500 px-3 py-1 text-sm">
            今日のタスク
          </Link>
        </nav>
      </header>
      <CalendarView />
    </section>
  );
}
```

- [ ] **Step 4 (Run, PASS):**

```bash
CI=true pnpm nx test habits -- --run src/routes/calendar/CalendarPage.test.tsx
```

- [ ] **Step 5 (Commit):**

```bash
git add apps/habits/src/routes/calendar/CalendarPage.tsx apps/habits/src/routes/calendar/CalendarPage.test.tsx
git commit -m "feat(habits): add /calendar route page (header + CalendarView)"
```

---

#### Task 12: router.tsx に `/calendar` ルートを追加

**Files:**
- Modify: `apps/habits/src/router.tsx`
- Modify: `apps/habits/src/App.test.tsx`

- [ ] **Step 1 (Red): `App.test.tsx` に `/history` テストの直前に挿入**

```tsx
it('認証済みで /calendar にアクセスすると「カレンダー」ページが表示される', async () => {
  getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
  await navigate('/calendar');
  render(<App />);
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'カレンダー' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 (Run, FAIL):**

```bash
CI=true pnpm nx test habits -- --run src/App.test.tsx
```

- [ ] **Step 3 (Green): `router.tsx` の修正**

```tsx
import { CalendarPage } from './routes/calendar/CalendarPage.js';
// ...
const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  beforeLoad: requireAuth,
  component: CalendarPage,
});
// ...
const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  tasksRoute,
  taskNewRoute,
  taskEditRoute,
  settingsTimeSlotsRoute,
  settingsNotificationsRoute,
  stashRoute,
  calendarRoute,
  historyRoute,
  authLoginRoute,
  authSignupRoute,
]);
```

- [ ] **Step 4 (Run, PASS):**

```bash
CI=true pnpm nx test habits -- --run src/App.test.tsx
```

- [ ] **Step 5 (Commit):**

```bash
git add apps/habits/src/router.tsx apps/habits/src/App.test.tsx
git commit -m "feat(habits): wire /calendar route with requireAuth"
```

---

#### Task 13: Today nav に「カレンダー」リンク追加

**Files:**
- Modify: `apps/habits/src/features/today/Today.tsx`
- Modify: `apps/habits/src/features/today/Today.test.tsx`

- [ ] **Step 1 (Red): `Today.test.tsx` 末尾に追加**

```tsx
it('カレンダーリンクが表示される', () => {
  render(<Today />);
  expect(screen.getByRole('link', { name: 'カレンダー' })).toBeInTheDocument();
});
```

- [ ] **Step 2 (Run, FAIL):**

```bash
CI=true pnpm nx test habits -- --run src/features/today/Today.test.tsx
```

- [ ] **Step 3 (Green): `Today.tsx` の nav の「履歴」リンク直前に挿入**

```tsx
<Link to="/calendar" className="rounded border border-gray-500 px-3 py-1 text-sm">
  カレンダー
</Link>
```

- [ ] **Step 4 (Run, PASS):**

```bash
CI=true pnpm nx test habits -- --run src/features/today/Today.test.tsx
```

- [ ] **Step 5 (Commit):**

```bash
git add apps/habits/src/features/today/Today.tsx apps/habits/src/features/today/Today.test.tsx
git commit -m "feat(habits): add calendar link to Today navigation"
```

---

### Phase F: CLAUDE.md 更新 + 全体検証

#### Task 14: CLAUDE.md にセクション追加

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: `### 履歴画面 / 過去ログ遅延取得（M9 以降）` セクションの直後に挿入**

```markdown
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
```

- [ ] **Step 2 (Commit):**

```bash
git add CLAUDE.md
git commit -m "docs: document calendar screen"
```

---

#### Task 15: 全体検証

- [ ] **Step 1: 型チェック + テスト**

```bash
CI=true pnpm nx affected -t typecheck test
```

- [ ] **Step 2: Biome**

```bash
pnpm exec biome ci .
```

Expected: 全 pass。

---

## 動作確認手順（手動）

```bash
supabase start
pnpm nx serve habits
```

1. `/today` にアクセス → nav に「カレンダー」リンクがあることを確認
2. クリックして `/calendar` に遷移
3. タスク select で複数タスクを切替えてグリッドが更新されることを確認
4. 月初・月末・前月オーバーラップ・翌月オーバーラップ各セルが正しい日付であること
5. 「今日」セルに amber リングが付くこと
6. 頻度マッチしない日（薄いグレー）はクリックしても変化しないこと
7. 未来日（今日より後）も同様にクリック不可
8. 過去日をクリック → empty → 濃青塗りつぶし(complete) → × 赤(fail) → – グレー(skip) → empty で循環すること
9. ← → ボタンで前月/次月へ遷移し、cutoff（today − 30 日）より古い月では一瞬ロード後にログが反映されること
10. 過去日の編集後、`/stash` に遷移すると集計（完了数 / 連続）が更新されていること
11. リロードしても直近 31 日内のセル編集結果は表示維持されること

---

## Critical Files for Implementation

実装で最も中心となるファイル（上位 5）:

- `packages/habit-core/src/month-grid.ts`
- `apps/habits/src/hooks/useTaskCalendar.ts`
- `apps/habits/src/features/calendar/CalendarView.tsx`
- `apps/habits/src/lib/calendar-status.ts`
- `apps/habits/src/router.tsx`
