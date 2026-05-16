# Habits App — M6: Today 画面 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設計仕様 `docs/superpowers/specs/2026-05-16-habits-app-design.md` §6.2 / §6.3 の Today 画面を完成させ、ログイン直後の `/today` で時間帯ごとに今日のタスクが表示され、各タスクの「完了 / スキップ / 失敗」3 ボタンで状態を切り替えると `state$.task_logs` が楽観更新され、syncedSupabase 経由で Supabase に反映される状態にする。

**Architecture:** `apps/habits/src/features/today/` を 4 つの React コンポーネント (`Today` / `TodayView` / `TimeSlotGroup` / `TodayTaskItem` / `StatusButtons`) に分解し、`useTodayTasks(today)` フックでビューモデルを購読する。書き込みは `packages/habit-sync` 側の純粋関数 `setTaskLogStatus(taskId, date, status)` / `clearTaskLogStatus(taskId, date)` で `state$.task_logs['${task_id}-${date}']` を変更し、syncedSupabase が自動で Supabase に upsert / delete する。`today` 文字列は `apps/habits/src/lib/today-date.ts` のヘルパーが端末ローカル日付から生成。

**Tech Stack:** React 19 / @testing-library/react + vitest (react preset) / Tailwind v4 / TanStack Router (existing) / `@org/habit-sync` の state$ + useTodayTasks (M5 で実装) / `@legendapp/state/react` の `use$` / `observer`

**前提条件:**
- M5 完了済（`main` の最新が `c340207 Merge branch 'feature/habits-m5-sync' into main`）
- `@org/habit-sync` から `state$`、`useTodayTasks` の元になる `getTodayTasksView`、`TodayTaskGroup` / `TodayTaskItem` / `DisplayTaskStatus` 型が export 済
- `apps/habits/src/hooks/useTodayTasks.ts` で `useTodayTasks(today: string): TodayTaskGroup[]` が動作する（M5 T9）
- 既存 `apps/habits/src/features/today/Today.tsx` には「今日のタスク」見出し + ログアウトボタン + プレースホルダ文があり、`Today.test.tsx` で 2 ケースが pass している
- 新規ブランチ `feature/habits-m6-today` を `main` から切って作業
- 設計仕様: §5.1（task_logs スキーマ）/ §6.2（features 配置）/ §6.3（状態フロー）

---

## ファイル構造（作成・変更対象）

```
packages/habit-sync/src/
  task-log-write.ts                 新規 — taskLogKey / setTaskLogStatus / clearTaskLogStatus
  task-log-write.test.ts            新規
  index.ts                          変更 — 新規エクスポート追加

apps/habits/src/
  lib/
    today-date.ts                   新規 — getTodayDateString(now?): 'YYYY-MM-DD'
    today-date.test.ts              新規
  features/today/
    StatusButtons.tsx               新規 — 3 ボタン UI（complete / skip / fail）
    StatusButtons.test.tsx          新規
    TodayTaskItem.tsx               新規 — タスク 1 行（名前 + StatusButtons）
    TodayTaskItem.test.tsx          新規
    TimeSlotGroup.tsx               新規 — スロット 1 つ分（見出し + 行リスト）
    TimeSlotGroup.test.tsx          新規
    TodayView.tsx                   新規 — useTodayTasks 購読 + Empty / リスト表示
    TodayView.test.tsx              新規
    Today.tsx                       変更 — TodayView を入れる、placeholder 削除
    Today.test.tsx                  変更 — TodayView を mock、見出し + ログアウト維持
```

**依存方向（変更なし）:** `apps/habits → packages/{habit-sync, habit-core}`、`packages/habit-sync → packages/habit-core`。書き込みは habit-sync が `state$` を操作するため新規依存なし。

---

## 共通方針

### 楽観更新フロー（§6.3）

```
[ユーザー操作] ──→ setTaskLogStatus(taskId, today, 'complete')
                  ├─ state$.task_logs['t1-2026-05-16'].set({...}) で即時反映
                  └─ syncedSupabase が変更を検知 → Supabase に upsert
[他デバイス] ──→ Realtime → state$.task_logs[...] が更新される
```

UI は `state$.task_logs` を `use$` で購読しているため、書き込み直後に必ず再描画される。失敗時のロールバックは legend-state の `syncedSupabase` retry queue に委ねる（M5 で実装済 IndexedDB 永続化と組み合わせ、復旧時に自動再送）。

### Status 切り替えの UX

- 各タスク行に 3 ボタン: 完了 / スキップ / 失敗
- 押された button は強調表示（`bg-green-500`, `bg-yellow-500`, `bg-red-500` 等）
- 同じ button をもう一度押すと「empty」に戻る（`clearTaskLogStatus` で行削除）
- 別 button を押すと status が切り替わる（`setTaskLogStatus`）

### `today` の決定

呼び出し側は `getTodayDateString()` を 1 度だけ呼ぶ。テストでは `now` を引数注入してタイムゾーン非依存に検証する。

```ts
getTodayDateString();          // 端末ローカル日付 (例: '2026-05-16')
getTodayDateString(new Date(2026, 4, 16, 23, 30));  // テスト用
```

### コンポーネント階層

```
Today
└── header (見出し + ログアウト)
└── TodayView
    └── (Empty 状態) or TimeSlotGroup[] (時間帯ごと)
        └── TodayTaskItem[]
            ├── タスク名
            └── StatusButtons
```

各コンポーネントは props を介して通信し、`state$` への直接アクセスは `TodayView` 内の `useTodayTasks` と書き込みヘルパー呼び出しだけにする。これによりテストが容易になる。

### コミット

各 Task の最後で単独コミット。pre-commit-gate hook が `pnpm nx affected -t lint test` を自動実行する。

---

## Task 1: `getTodayDateString` ヘルパー

**目的:** 端末ローカル日付を `'YYYY-MM-DD'` 文字列で返す純粋関数。`useSyncBootstrap` で同様のコードがインラインで書かれている（M5 T10）が、共通化はしない（YAGNI: 後で必要になったら抽出する）。`Today` 画面側で使うのが本タスクの目的。

**Files:**
- Create: `apps/habits/src/lib/today-date.ts`
- Create: `apps/habits/src/lib/today-date.test.ts`

- [ ] **Step 1: テスト作成**

`apps/habits/src/lib/today-date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getTodayDateString } from './today-date.js';

describe('getTodayDateString', () => {
  it('引数の Date から YYYY-MM-DD を返す', () => {
    expect(getTodayDateString(new Date(2026, 4, 16, 9, 30))).toBe('2026-05-16');
  });

  it('月と日が 1 桁の場合はゼロパディングされる', () => {
    expect(getTodayDateString(new Date(2026, 0, 3, 0, 0))).toBe('2026-01-03');
  });

  it('深夜は当日の日付（タイムゾーン非依存、ローカル時刻ベース）', () => {
    expect(getTodayDateString(new Date(2026, 4, 16, 23, 59))).toBe('2026-05-16');
  });

  it('引数なしの場合は new Date() のローカル日付を返す（形式チェックのみ）', () => {
    const today = getTodayDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/lib/today-date.test.ts
```

Expected: `Failed to resolve import "./today-date"` で fail。

- [ ] **Step 3: 実装作成**

`apps/habits/src/lib/today-date.ts`:

```ts
// 端末ローカル時刻から 'YYYY-MM-DD' 文字列を返す。
// 引数 now は主にテスト用。本番では new Date() が使われる。
export function getTodayDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/lib/today-date.test.ts
```

Expected: 4 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/lib/today-date.ts apps/habits/src/lib/today-date.test.ts
git commit -m "$(cat <<'EOF'
feat(habits): getTodayDateString で端末ローカル日付を YYYY-MM-DD で返す

引数注入可能で、月・日のゼロパディングを保証する純粋関数。
M6 の Today 画面で today の文字列を一貫した形式で取得する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `task-log-write.ts` — state$.task_logs への書き込みヘルパー

**目的:** `state$.task_logs['${task_id}-${date}']` の set / delete をラップし、`taskLogKey(taskId, date)` でキーを一意化する純粋関数を提供する。React 側はこのヘルパーを呼ぶだけで楽観更新 + syncedSupabase 連携が成立する。

**Files:**
- Create: `packages/habit-sync/src/task-log-write.ts`
- Create: `packages/habit-sync/src/task-log-write.test.ts`
- Modify: `packages/habit-sync/src/index.ts`

- [ ] **Step 1: テスト作成**

`packages/habit-sync/src/task-log-write.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { state$ } from './observables.js';
import { clearTaskLogStatus, setTaskLogStatus, taskLogKey } from './task-log-write.js';

describe('taskLogKey', () => {
  it('task_id と date を - で結合する', () => {
    expect(taskLogKey('t1', '2026-05-16')).toBe('t1-2026-05-16');
  });

  it('UUID 形式の task_id でも正しく動く', () => {
    expect(taskLogKey('11111111-2222-3333-4444-555555555555', '2026-05-16')).toBe(
      '11111111-2222-3333-4444-555555555555-2026-05-16',
    );
  });
});

describe('setTaskLogStatus', () => {
  beforeEach(() => {
    state$.task_logs.set({});
  });

  it('state$.task_logs[key] に row を設定する', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    const row = state$.task_logs.get()['t1-2026-05-16'];
    expect(row).toBeDefined();
    expect(row?.task_id).toBe('t1');
    expect(row?.date).toBe('2026-05-16');
    expect(row?.status).toBe('complete');
  });

  it('status だけ書き換える場合も既存行と同じキーで上書きされる', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    setTaskLogStatus('t1', '2026-05-16', 'skip');
    expect(state$.task_logs.get()['t1-2026-05-16']?.status).toBe('skip');
  });

  it('別 task / 別 date は独立したキーで保存される', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    setTaskLogStatus('t2', '2026-05-16', 'fail');
    setTaskLogStatus('t1', '2026-05-15', 'skip');
    const logs = state$.task_logs.get();
    expect(logs['t1-2026-05-16']?.status).toBe('complete');
    expect(logs['t2-2026-05-16']?.status).toBe('fail');
    expect(logs['t1-2026-05-15']?.status).toBe('skip');
  });

  it('created_at / updated_at に ISO 文字列を埋める', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    const row = state$.task_logs.get()['t1-2026-05-16'];
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('clearTaskLogStatus', () => {
  beforeEach(() => {
    state$.task_logs.set({});
  });

  it('指定キーの行を削除する', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    expect(state$.task_logs.get()['t1-2026-05-16']).toBeDefined();
    clearTaskLogStatus('t1', '2026-05-16');
    expect(state$.task_logs.get()['t1-2026-05-16']).toBeUndefined();
  });

  it('存在しないキーを削除しても例外を投げない', () => {
    expect(() => clearTaskLogStatus('t-not-exist', '2026-05-16')).not.toThrow();
  });

  it('別キーには影響しない', () => {
    setTaskLogStatus('t1', '2026-05-16', 'complete');
    setTaskLogStatus('t2', '2026-05-16', 'fail');
    clearTaskLogStatus('t1', '2026-05-16');
    expect(state$.task_logs.get()['t2-2026-05-16']).toBeDefined();
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/task-log-write.test.ts
```

Expected: `./task-log-write` が見つからず fail。

- [ ] **Step 3: 実装作成**

`packages/habit-sync/src/task-log-write.ts`:

```ts
import { state$ } from './observables.js';
import type { TaskLog, TaskStatus } from './types.js';

// state$.task_logs の Record キー。複合 PK (task_id, date) を単一文字列に。
export function taskLogKey(taskId: string, date: string): string {
  return `${taskId}-${date}`;
}

// state$.task_logs[key] に新しい行を書き込む。
// 楽観更新: syncedSupabase が変更を検知して Supabase に upsert する。
// created_at / updated_at は ISO 文字列を埋めるが、syncedSupabase 接続時は
// サーバー値で上書きされる（M5 で接続済）。
export function setTaskLogStatus(taskId: string, date: string, status: TaskStatus): void {
  const now = new Date().toISOString();
  const row: TaskLog = {
    task_id: taskId,
    date,
    status,
    created_at: now,
    updated_at: now,
  };
  state$.task_logs[taskLogKey(taskId, date)].set(row);
}

// state$.task_logs[key] を削除する。
// 楽観更新: syncedSupabase が変更を検知して Supabase に delete を発行する。
export function clearTaskLogStatus(taskId: string, date: string): void {
  state$.task_logs[taskLogKey(taskId, date)].delete();
}
```

> **注:** legend-state v3 beta では `state$.foo['key'].delete()` または `state$.foo['key'].set(undefined)` で削除する。`undefined` 設定だと Record 内にキーが残る可能性があるため `.delete()` を使う。`.delete()` が型エラーになる場合は `state$.task_logs[key].set(undefined as unknown as TaskLog)` で代替し、`getTodayTasksView` 側が `Object.values` 後に undefined を除外する形にする（既存の `Object.values` は undefined 値を返さないので問題ないが、念のため確認）。

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-sync -- --run packages/habit-sync/src/task-log-write.test.ts
```

Expected: 10 件 pass (taskLogKey 2 + setTaskLogStatus 4 + clearTaskLogStatus 3 ＝ `it` ベースで 9、+1 が誤算なので 9 件)。

実数: `taskLogKey` 2件、`setTaskLogStatus` 4件、`clearTaskLogStatus` 3件 = **9件 pass**。

> **fail する場合:** `state$.task_logs[key].delete()` が型エラーまたは実行時例外を出すなら、代替: `state$.task_logs.set((prev) => { const next = { ...prev }; delete next[key]; return next; })`。あるいは legend-state v3 の Map 系 API を確認。

- [ ] **Step 5: `index.ts` に re-export 追加**

`packages/habit-sync/src/index.ts` の末尾（Biome が並び替える）に追加:

```ts
export { clearTaskLogStatus, setTaskLogStatus, taskLogKey } from './task-log-write.js';
```

- [ ] **Step 6: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
pnpm exec biome ci packages/habit-sync/src/
git add packages/habit-sync/src/task-log-write.ts packages/habit-sync/src/task-log-write.test.ts packages/habit-sync/src/index.ts
git commit -m "$(cat <<'EOF'
feat(habit-sync): setTaskLogStatus / clearTaskLogStatus で task_log を楽観更新

state$.task_logs['\${task_id}-\${date}'] に set/delete を行う薄いラッパー。
syncedSupabase が変更を検知して Supabase に upsert/delete を自動発行する。
taskLogKey ヘルパーで複合 PK を単一文字列キーに変換。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `StatusButtons` コンポーネント

**目的:** 3 ボタン（完了 / スキップ / 失敗）の UI。`current` で現状のステータスを受け取り、`onChange(next | null)` を呼ぶ。同じ button を再クリックすると null（empty）を返す。アクティブな button は背景色で強調する。

**Files:**
- Create: `apps/habits/src/features/today/StatusButtons.tsx`
- Create: `apps/habits/src/features/today/StatusButtons.test.tsx`

- [ ] **Step 1: テスト作成**

`apps/habits/src/features/today/StatusButtons.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusButtons } from './StatusButtons.js';

describe('StatusButtons', () => {
  it('完了 / スキップ / 失敗 の 3 ボタンを表示する', () => {
    render(<StatusButtons current="empty" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '完了' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'スキップ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '失敗' })).toBeInTheDocument();
  });

  it('current が empty で「完了」クリックすると onChange("complete") が呼ばれる', () => {
    const onChange = vi.fn();
    render(<StatusButtons current="empty" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    expect(onChange).toHaveBeenCalledWith('complete');
  });

  it('current が empty で「スキップ」クリックすると onChange("skip")', () => {
    const onChange = vi.fn();
    render(<StatusButtons current="empty" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(onChange).toHaveBeenCalledWith('skip');
  });

  it('current が empty で「失敗」クリックすると onChange("fail")', () => {
    const onChange = vi.fn();
    render(<StatusButtons current="empty" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '失敗' }));
    expect(onChange).toHaveBeenCalledWith('fail');
  });

  it('current が complete で「完了」クリックすると onChange(null)（解除）', () => {
    const onChange = vi.fn();
    render(<StatusButtons current="complete" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('current が complete で「スキップ」クリックすると onChange("skip")（切り替え）', () => {
    const onChange = vi.fn();
    render(<StatusButtons current="complete" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(onChange).toHaveBeenCalledWith('skip');
  });

  it('アクティブな button には aria-pressed="true" が付く', () => {
    render(<StatusButtons current="complete" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '完了' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'スキップ' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '失敗' })).toHaveAttribute('aria-pressed', 'false');
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/StatusButtons.test.tsx
```

- [ ] **Step 3: 実装作成**

`apps/habits/src/features/today/StatusButtons.tsx`:

```tsx
import type { DisplayTaskStatus, TaskStatus } from '@org/habit-sync';

export interface StatusButtonsProps {
  current: DisplayTaskStatus;
  onChange: (next: TaskStatus | null) => void;
}

// 3 状態の切り替えボタン。
// - 現在の status をクリックすると null（empty）に戻す
// - 別の status をクリックすると切り替え
const STATUS_OPTIONS: ReadonlyArray<{ value: TaskStatus; label: string; activeClass: string }> = [
  { value: 'complete', label: '完了', activeClass: 'bg-green-600 text-white' },
  { value: 'skip', label: 'スキップ', activeClass: 'bg-yellow-600 text-white' },
  { value: 'fail', label: '失敗', activeClass: 'bg-red-600 text-white' },
];

const INACTIVE_CLASS = 'bg-transparent text-game-fg border-gray-500';

export function StatusButtons({ current, onChange }: StatusButtonsProps): React.ReactElement {
  return (
    <div role="group" className="flex gap-2">
      {STATUS_OPTIONS.map((opt) => {
        const isActive = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              onChange(isActive ? null : opt.value);
            }}
            className={`rounded border px-3 py-1 text-sm ${isActive ? opt.activeClass : INACTIVE_CLASS}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/StatusButtons.test.tsx
```

Expected: 7 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/today/StatusButtons.tsx apps/habits/src/features/today/StatusButtons.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): StatusButtons (完了/スキップ/失敗) 3 ボタン UI

current === clicked なら null を返して empty に戻す、別 status なら切り替え。
aria-pressed でアクティブ状態をアクセシビリティに表現。
背景色で視覚的にハイライト。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `TodayTaskItem` コンポーネント

**目的:** タスク 1 行を描画。タスク名 + `StatusButtons`。ボタン押下時に `setTaskLogStatus` / `clearTaskLogStatus` を呼んで `state$.task_logs` を楽観更新する。

**Files:**
- Create: `apps/habits/src/features/today/TodayTaskItem.tsx`
- Create: `apps/habits/src/features/today/TodayTaskItem.test.tsx`

- [ ] **Step 1: テスト作成**

`apps/habits/src/features/today/TodayTaskItem.test.tsx`:

```tsx
import { state$, type TodayTaskItem as TodayTaskItemModel } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodayTaskItem } from './TodayTaskItem.js';

const today = '2026-05-16';
const baseItem: TodayTaskItemModel = {
  id: 't1',
  name: '歯磨き',
  status: 'empty',
  sort_order: 0,
};

describe('TodayTaskItem', () => {
  beforeEach(() => {
    state$.task_logs.set({});
  });

  it('タスク名を表示する', () => {
    render(<TodayTaskItem item={baseItem} today={today} />);
    expect(screen.getByText('歯磨き')).toBeInTheDocument();
  });

  it('「完了」クリックで state$.task_logs にエントリが入る', () => {
    render(<TodayTaskItem item={baseItem} today={today} />);
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    const row = state$.task_logs.get()['t1-2026-05-16'];
    expect(row?.status).toBe('complete');
  });

  it('「スキップ」クリックで state$.task_logs に skip が入る', () => {
    render(<TodayTaskItem item={baseItem} today={today} />);
    fireEvent.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(state$.task_logs.get()['t1-2026-05-16']?.status).toBe('skip');
  });

  it('現状 complete のときに「完了」を押すと state$.task_logs[key] が削除される', () => {
    state$.task_logs.set({
      't1-2026-05-16': {
        task_id: 't1',
        date: '2026-05-16',
        status: 'complete',
        created_at: '2026-05-16T00:00:00Z',
        updated_at: '2026-05-16T00:00:00Z',
      },
    });
    render(<TodayTaskItem item={{ ...baseItem, status: 'complete' }} today={today} />);
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    expect(state$.task_logs.get()['t1-2026-05-16']).toBeUndefined();
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/TodayTaskItem.test.tsx
```

- [ ] **Step 3: 実装作成**

`apps/habits/src/features/today/TodayTaskItem.tsx`:

```tsx
import { clearTaskLogStatus, setTaskLogStatus, type TodayTaskItem as TodayTaskItemModel } from '@org/habit-sync';
import { StatusButtons } from './StatusButtons.js';

export interface TodayTaskItemProps {
  item: TodayTaskItemModel;
  today: string;
}

export function TodayTaskItem({ item, today }: TodayTaskItemProps): React.ReactElement {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="flex-1 text-sm">{item.name}</span>
      <StatusButtons
        current={item.status}
        onChange={(next) => {
          if (next === null) {
            clearTaskLogStatus(item.id, today);
          } else {
            setTaskLogStatus(item.id, today, next);
          }
        }}
      />
    </li>
  );
}
```

> **型名重複の注意:** `@org/habit-sync` が export する `TodayTaskItem` は domain type。本ファイルのコンポーネント名と同名なので、import 時に `type TodayTaskItem as TodayTaskItemModel` でリネームしている。

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/TodayTaskItem.test.tsx
```

Expected: 4 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/today/TodayTaskItem.tsx apps/habits/src/features/today/TodayTaskItem.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): TodayTaskItem (タスク 1 行) + 楽観更新

タスク名 + StatusButtons を組み合わせ、ボタン押下で
setTaskLogStatus / clearTaskLogStatus を呼ぶ。
state$.task_logs が即時更新され、syncedSupabase が Supabase に反映する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `TimeSlotGroup` コンポーネント

**目的:** 時間帯 1 つ分のセクション。見出し（朝 / 夜等の名前 + 通知時刻）+ そのスロットのタスク一覧を `TodayTaskItem` で展開する。

**Files:**
- Create: `apps/habits/src/features/today/TimeSlotGroup.tsx`
- Create: `apps/habits/src/features/today/TimeSlotGroup.test.tsx`

- [ ] **Step 1: テスト作成**

`apps/habits/src/features/today/TimeSlotGroup.test.tsx`:

```tsx
import type { TodayTaskGroup } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimeSlotGroup } from './TimeSlotGroup.js';

const today = '2026-05-16';
const baseGroup: TodayTaskGroup = {
  time_slot_id: 's1',
  slot_name: '朝',
  notify_at: '07:00:00',
  slot_sort_order: 0,
  tasks: [
    { id: 't1', name: '歯磨き', status: 'empty', sort_order: 0 },
    { id: 't2', name: 'メール確認', status: 'complete', sort_order: 1 },
  ],
};

describe('TimeSlotGroup', () => {
  it('スロット名を見出しとして表示する', () => {
    render(<TimeSlotGroup group={baseGroup} today={today} />);
    expect(screen.getByRole('heading', { name: /朝/ })).toBeInTheDocument();
  });

  it('notify_at を HH:MM 形式で表示する（秒は省く）', () => {
    render(<TimeSlotGroup group={baseGroup} today={today} />);
    expect(screen.getByText('07:00')).toBeInTheDocument();
  });

  it('group.tasks の各タスクを表示する', () => {
    render(<TimeSlotGroup group={baseGroup} today={today} />);
    expect(screen.getByText('歯磨き')).toBeInTheDocument();
    expect(screen.getByText('メール確認')).toBeInTheDocument();
  });

  it('tasks が空の場合は「タスクなし」を表示する', () => {
    render(<TimeSlotGroup group={{ ...baseGroup, tasks: [] }} today={today} />);
    expect(screen.getByText(/タスクなし/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/TimeSlotGroup.test.tsx
```

- [ ] **Step 3: 実装作成**

`apps/habits/src/features/today/TimeSlotGroup.tsx`:

```tsx
import type { TodayTaskGroup } from '@org/habit-sync';
import { TodayTaskItem } from './TodayTaskItem.js';

export interface TimeSlotGroupProps {
  group: TodayTaskGroup;
  today: string;
}

// notify_at が 'HH:MM:SS' 形式で渡される（time 型）。表示用に HH:MM に切る。
function formatTime(notifyAt: string): string {
  return notifyAt.slice(0, 5);
}

export function TimeSlotGroup({ group, today }: TimeSlotGroupProps): React.ReactElement {
  return (
    <section className="space-y-2">
      <header className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold text-game-accent">{group.slot_name}</h2>
        <span className="text-sm text-gray-400">{formatTime(group.notify_at)}</span>
      </header>
      {group.tasks.length === 0 ? (
        <p className="text-sm text-gray-400">タスクなし</p>
      ) : (
        <ul className="divide-y divide-gray-700">
          {group.tasks.map((item) => (
            <TodayTaskItem key={item.id} item={item} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/TimeSlotGroup.test.tsx
```

Expected: 4 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/today/TimeSlotGroup.tsx apps/habits/src/features/today/TimeSlotGroup.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): TimeSlotGroup (時間帯セクション) を実装

スロット名 + notify_at (HH:MM) + タスク一覧を表示。
タスク 0 件のスロットは「タスクなし」を表示。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `TodayView` コンポーネント

**目的:** `useTodayTasks(today)` を呼んで `TodayTaskGroup[]` を取得し、`TimeSlotGroup` を時間帯順に並べる。タスクがゼロ件のときは Empty 状態を表示する。

**Files:**
- Create: `apps/habits/src/features/today/TodayView.tsx`
- Create: `apps/habits/src/features/today/TodayView.test.tsx`

- [ ] **Step 1: テスト作成**

`apps/habits/src/features/today/TodayView.test.tsx`:

```tsx
import { state$, type Task, type TimeSlot } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodayView } from './TodayView.js';

const today = '2026-05-16';

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

describe('TodayView', () => {
  beforeEach(() => {
    state$.tasks.set({});
    state$.task_logs.set({});
    state$.time_slots.set({});
  });

  it('タスクが 0 件の場合は Empty 状態を表示する', () => {
    render(<TodayView today={today} />);
    expect(screen.getByText(/今日のタスクはありません/)).toBeInTheDocument();
  });

  it('タスクが 1 件あればそのタスク名が表示される', () => {
    state$.tasks.set({
      t1: task({ id: 't1', time_slot_id: 's1', name: '歯磨き' }),
    });
    state$.time_slots.set({
      s1: slot({ id: 's1', name: '朝', sort_order: 0 }),
    });
    render(<TodayView today={today} />);
    expect(screen.getByText('歯磨き')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /朝/ })).toBeInTheDocument();
  });

  it('複数スロットがあれば slot_sort_order 順に表示される', () => {
    state$.tasks.set({
      t1: task({ id: 't1', time_slot_id: 's2', name: '夜タスク' }),
      t2: task({ id: 't2', time_slot_id: 's1', name: '朝タスク' }),
    });
    state$.time_slots.set({
      s1: slot({ id: 's1', name: '朝', sort_order: 0 }),
      s2: slot({ id: 's2', name: '夜', sort_order: 1 }),
    });
    render(<TodayView today={today} />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]).toHaveTextContent('朝');
    expect(headings[1]).toHaveTextContent('夜');
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/TodayView.test.tsx
```

- [ ] **Step 3: 実装作成**

`apps/habits/src/features/today/TodayView.tsx`:

```tsx
import { useTodayTasks } from '../../hooks/useTodayTasks.js';
import { TimeSlotGroup } from './TimeSlotGroup.js';

export interface TodayViewProps {
  today: string;
}

export function TodayView({ today }: TodayViewProps): React.ReactElement {
  const groups = useTodayTasks(today);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        今日のタスクはありません。タスクを追加するか、頻度設定を見直してください。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <TimeSlotGroup key={group.time_slot_id} group={group} today={today} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/TodayView.test.tsx
```

Expected: 3 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add apps/habits/src/features/today/TodayView.tsx apps/habits/src/features/today/TodayView.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): TodayView で useTodayTasks を購読しグループを描画

タスク 0 件は Empty メッセージ、1 件以上は TimeSlotGroup を slot_sort_order 順で展開。
state$ の変更で再描画される（use$ の購読チェーン経由）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `Today.tsx` 本体を `TodayView` で置き換える

**目的:** 既存の placeholder 文を削除し、`TodayView` を組み込む。ヘッダー（見出し + ログアウトボタン）は維持。`today` 文字列は `getTodayDateString()` で取得。`Today.test.tsx` は `TodayView` を mock し、既存 2 ケース（見出し + ログアウト）を維持しつつ「TodayView が呼ばれる」アサーションを追加。

**Files:**
- Modify: `apps/habits/src/features/today/Today.tsx`
- Modify: `apps/habits/src/features/today/Today.test.tsx`

- [ ] **Step 1: `Today.tsx` を更新**

`apps/habits/src/features/today/Today.tsx` の全内容を以下に置き換える:

```tsx
import { useNavigate } from '@tanstack/react-router';
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
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-game-accent">今日のタスク</h1>
        <button
          type="button"
          onClick={() => {
            void handleSignOut();
          }}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          ログアウト
        </button>
      </header>
      <TodayView today={today} />
    </section>
  );
}
```

- [ ] **Step 2: `Today.test.tsx` を更新**

`apps/habits/src/features/today/Today.test.tsx` の全内容を以下に置き換える:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Today } from './Today.js';

vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signOut: vi.fn() } }),
}));

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: (): typeof navigateMock => navigateMock,
  };
});

const signOutMock = vi.fn();
vi.mock('../../lib/auth.js', () => ({
  signOut: (...args: unknown[]): unknown => signOutMock(...args),
}));

// TodayView は別途テスト済み。Today のテストでは「呼ばれる」ことのみ確認
const todayViewMock = vi.fn();
vi.mock('./TodayView.js', () => ({
  TodayView: (props: { today: string }) => {
    todayViewMock(props);
    return <div data-testid="today-view">today={props.today}</div>;
  },
}));

describe('Today', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signOutMock.mockReset();
    todayViewMock.mockReset();
  });

  it('「今日のタスク」見出しを表示する', () => {
    render(<Today />);
    expect(screen.getByRole('heading', { name: '今日のタスク' })).toBeInTheDocument();
  });

  it('TodayView に today (YYYY-MM-DD) を渡す', () => {
    render(<Today />);
    expect(todayViewMock).toHaveBeenCalledTimes(1);
    const props = todayViewMock.mock.calls[0][0];
    expect(props.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ログアウトボタンクリックで signOut → /auth/login へ navigate', async () => {
    signOutMock.mockResolvedValue({ ok: true });
    render(<Today />);
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith({ to: '/auth/login' });
    });
  });
});
```

- [ ] **Step 3: テスト通過確認**

```bash
CI=true pnpm nx test @org/habits -- --run apps/habits/src/features/today/Today.test.tsx
```

Expected: 3 件 pass（既存 2 件 + 新規 TodayView prop 検証 1 件）。

- [ ] **Step 4: 全プロジェクト緑確認**

```bash
CI=true pnpm nx run-many -t typecheck lint test --skip-nx-cache
pnpm exec biome ci .
```

Expected: 全プロジェクト緑。M5 までの 173 件 + 本マイルストーンで追加した: today-date 4 + task-log-write 9 + StatusButtons 7 + TodayTaskItem 4 + TimeSlotGroup 4 + TodayView 3 + Today 3 (うち 2 件は既存) = **34 件追加**、合計 **207 件**。

- [ ] **Step 5: コミット**

```bash
git add apps/habits/src/features/today/Today.tsx apps/habits/src/features/today/Today.test.tsx
git commit -m "$(cat <<'EOF'
feat(habits): Today.tsx で TodayView を組み込む

placeholder 文を削除し、TodayView コンポーネントで時間帯別タスクを描画。
getTodayDateString() で today を取得し、TodayView に prop で渡す。
Today.test.tsx は TodayView を mock 化、見出し + today 受け渡し + ログアウトの 3 ケース。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: (任意) 手動 E2E 検証 + CLAUDE.md 追記

**目的:** ローカル Supabase + dev サーバーで signup → /today で初期 6 タスクが表示 → 完了/スキップ/失敗ボタンが Supabase に反映 → リロード後も状態が保持される、を確認する。

**Files:**
- Modify: `CLAUDE.md`

### 検証手順

- [ ] **Step 1: 環境準備**

```bash
supabase start
supabase db reset
pnpm nx serve habits
```

- [ ] **Step 2: ブラウザで新規登録 → /today**

`http://localhost:5173/auth/signup` で `test+m6@example.com` / `password123` を入力 → 登録。

Expected:
- `/today` に遷移する
- 「今日のタスク」見出しと「ログアウト」ボタンが表示される
- 「朝」「夜」のセクションが表示される（M2 トリガーで作成された 2 つの time_slot）
- 朝に 4 タスク（歯磨き / メール確認 / タスク見直し / 不燃物ゴミ）、夜に 2 タスク（運動 / 掃除）が頻度に応じて表示される（今日が頻度マッチでないものは表示されない）

- [ ] **Step 3: 完了ボタンを押して即時反映を確認**

任意のタスクで「完了」ボタンをクリック。

Expected:
- ボタンが緑色にハイライトされる（即時、ネットワーク待ちなし）
- リロード後も「完了」状態が維持されている（IndexedDB から復元）

別ターミナルで psql で確認:

```bash
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT task_id, date, status FROM task_logs WHERE date = CURRENT_DATE;"
```

Expected: 押したタスクの行が `status = 'complete'` で返ってくる。

- [ ] **Step 4: 状態切り替えと解除を確認**

押した「完了」を再クリック → 解除（ハイライト消える + psql で該当行が消える）。
「スキップ」を押す → 状態切り替え（ハイライトが黄色に）。

- [ ] **Step 5: オフライン → 再接続テスト**

DevTools の Network タブで Offline に切り替え → 状態を変更 → ボタンは即時反映される。
Online に戻す → psql で確認、変更が反映されている。

- [ ] **Step 6: CLAUDE.md に M6 メモを追記**

`/Users/ikomiki/workspace/daily-task/CLAUDE.md` の `### 同期レイヤー（M5 以降）` セクションの後（`## E2E（Playwright）` の前）に追加:

```markdown

### Today 画面（M6 以降）

- `apps/habits/src/features/today/` 配下に `Today` / `TodayView` / `TimeSlotGroup` / `TodayTaskItem` / `StatusButtons` を実装
- 3 ボタン（完了 / スキップ / 失敗）で `state$.task_logs['${task_id}-${today}']` を楽観更新
- 同じ button を再度押すと empty（行削除）に戻る、別 button で切り替え
- 書き込みヘルパー: `@org/habit-sync` の `setTaskLogStatus(taskId, date, status)` / `clearTaskLogStatus(taskId, date)`
- `today` 文字列は `apps/habits/src/lib/today-date.ts` の `getTodayDateString()` で生成
```

- [ ] **Step 7: コミット**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: CLAUDE.md に M6 Today 画面の運用メモを追記

Today 配下のコンポーネント構成、楽観更新のフロー、書き込みヘルパーの
場所と命名規則を簡潔にメモ。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

> **このタスクをスキップする判断:** Docker や Supabase CLI が環境に無い場合、Task 8 全体をスキップして M6 を終了して問題ない（M5 までで syncedSupabase 接続テスト + 本タスクの component test 群でロジックは網羅済）。

---

## 次のマイルストーン

このプラン完了後、次は **M7: タスク管理（Task CRUD + FrequencyPicker + TimeSlot CRUD）** の実装プランを `docs/superpowers/plans/2026-05-16-habits-app-m7-task-crud.md` として作成する。M7 で扱う内容:

- `/tasks` ルートと `TaskList` 画面（既存タスクの一覧 + アーカイブ済表示切替）
- `/tasks/new` / `/tasks/:id` ルートと `TaskEdit` フォーム
- `FrequencyPicker` コンポーネント（5 type の頻度ルールを UI で構築）
- `/settings/time-slots` で `TimeSlot CRUD`（最低 1 個は残す）
- 楽観更新 + Supabase 反映（M5 の同期層を経由）

---

## 自己レビュー結果

仕様カバレッジ（§5.1 / §6.2 / §6.3）:

- ✅ §6.2 features/today/ の 5 コンポーネント (Today / TodayView / TimeSlotGroup / TodayTaskItem / StatusButtons): Task 3-7
- ✅ §6.3 楽観更新フロー（state$.task_logs に書き込み → UI 即時更新 → syncedSupabase が Supabase へ反映）: Task 2 (書き込み) + Task 4 (UI 連動)
- ✅ §5.1 task_logs の status: 'complete' | 'skip' | 'fail' に対応、empty は行削除で表現: Task 3 (StatusButtons の null 返却) + Task 2 (clearTaskLogStatus)
- ✅ time_slot ごとのグループ化、sort_order 順表示: Task 5 + Task 6
- ✅ タスク 0 件時の Empty 状態: Task 6
- ✅ today の文字列生成: Task 1
- ✅ アクセシビリティ (aria-pressed): Task 3

型整合性:

- `DisplayTaskStatus` (`@org/habit-sync` 経由で M5 から export) は `'complete' | 'skip' | 'fail' | 'empty'`、`TaskStatus` は `'complete' | 'skip' | 'fail'`。Task 3 (StatusButtons) は `current: DisplayTaskStatus` を受け、`onChange: (next: TaskStatus | null) => void` を発火する。null は empty を意味する。
- `TodayTaskGroup` / `TodayTaskItem` (`@org/habit-sync` 経由) は M5 で定義済み。本プラン内の component 名 `TodayTaskItem` と型名が重複するため、import で `TodayTaskItem as TodayTaskItemModel` のリネームを Task 4 で明記。
- 書き込みヘルパーのシグネチャ: `setTaskLogStatus(taskId: string, date: string, status: TaskStatus): void`、`clearTaskLogStatus(taskId: string, date: string): void`、`taskLogKey(taskId: string, date: string): string` で全 Task 一貫。
- `today` は全コンポーネントで `string` 型、`getTodayDateString` の戻り値で統一。

プレースホルダ:

- なし。すべての test / 実装 / コマンド / mock が具体的記述。
- Task 2 の `.delete()` API について legend-state v3 beta での挙動が不安定な場合の fallback を明記。
- Task 8 をスキップする判断条件も明示。

リスク（実装時に注意）:

- **`state$.task_logs[key].delete()` の挙動**: legend-state v3 beta では `.delete()` が Observable から Record の key を削除するはず（公式の `.delete()` API）。型エラー or 例外時は `state$.task_logs.set((prev) => { const next = { ...prev }; delete next[key]; return next; })` で代替（Task 2 のテストはこの差異を吸収できる形になっている）。
- **`Object.values` と `undefined` 値**: `clearTaskLogStatus` が `set(undefined)` を使う場合 `state$.task_logs.get()` の Object に undefined エントリが残る可能性がある。`getTodayTasksView` (M5 で実装済) は `Object.values(taskLogs)` を呼ぶが、undefined 含む配列を扱うため filter が追加で必要かも。Task 2 のテストで状態を観察し、必要なら getTodayTasksView を更新するという判断は本プラン外（M5 マイルストーン側の調整）。とりあえず `.delete()` を試して動けば不要。
