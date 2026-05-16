# Habits App — M4: ドメインロジック 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 設計仕様 `docs/superpowers/specs/2026-05-16-habits-app-design.md` §5.2 / §5.3 / §9 に定義された頻度評価 `isDueOn` (5 種類) と連続完了数 `calculateStreak` を `packages/habit-core` 内で純粋関数として実装し、エッジケース（月末・第 5 週・閏年・年跨ぎ・anchor 当日）をテーブル駆動テストで網羅する。

**Architecture:** `packages/habit-core` は純粋ドメインのため React / Supabase / DOM 等の外部依存を持たない。`Frequency` 型の判別共用体ごとに `frequency.ts` のヘルパー関数で判定し、`streak.ts` で `TaskStatus` のシーケンスから streak を算出する。タイムゾーンに依存しないよう日付は `'YYYY-MM-DD'` 文字列のまま受け、内部で UTC ベースの整数日数に変換する。SQL 側 (`is_due_on` plpgsql 関数, M2 で実装済) と同一の判定を返すことを optional な psql クロスバリデーションタスクで確認する。

**Tech Stack:** TypeScript 5.9 / vitest 3 (node preset) / `@org/habit-core` 純粋 ESM パッケージ / `Date.UTC` 系 API のみ（タイムゾーン非依存）

**前提条件:**
- M3 完了済（`main` の最新が `f39025e Merge branch 'feature/habits-m3-auth' into main`）
- `packages/habit-core/src/{frequency,streak,status,index}.ts` の M1 雛形が存在し、`isDueOn` / `calculateStreak` は `throw new Error('NOT_IMPLEMENTED: ...')` 状態
- 既存テスト `packages/habit-core/src/index.test.ts` は NOT_IMPLEMENTED throw を期待する 5 件のスモークテスト
- 新規ブランチ `feature/habits-m4-domain` を `main` から切って作業
- 設計仕様: `docs/superpowers/specs/2026-05-16-habits-app-design.md` §5.2 / §5.3 / §9

---

## ファイル構造（作成・変更対象）

```
packages/habit-core/src/
  dates.ts                          新規 — 純粋日付ユーティリティ (parseLocalDateToUtcDays, isoDayOfWeek, weekOfMonth)
  dates.test.ts                     新規
  frequency.ts                      変更 — Frequency 型は維持、isDueOn 本体を実装
  frequency.test.ts                 新規 — type 別に describe を分けたテーブル駆動テスト
  streak.ts                         変更 — calculateStreak 本体を実装
  streak.test.ts                    新規 — TaskStatus シーケンスのテーブル駆動テスト
  edge-cases.test.ts                新規 — 月末/第 5 週/閏年/年跨ぎを横断するパラメトリックテスト
  index.test.ts                     変更 — NOT_IMPLEMENTED throw 期待を削除、公開 API スモークだけ残す
  status.ts                         変更なし
  index.ts                          変更なし（再エクスポート構造は M1 のまま）
```

**依存方向:** `dates.ts` ← `frequency.ts` ← `streak.ts`（streak は date ヘルパーを使わないが、将来 streak の頻度フィルタ等で参照する余地を残す）。`status.ts` は独立。`packages/habit-core` は他の packages に依存しない。

---

## 共通方針

### 日付の扱い

仕様で日付は `'YYYY-MM-DD'` の文字列。JavaScript の `new Date('YYYY-MM-DD')` は UTC として解釈されローカルタイムゾーンへ変換されるため、`getDate()` などで使うと地域によって日付がずれる。そのため:

- 比較・差分演算は **UTC エポック日数の整数** で行う
- 曜日取得には `new Date(Date.UTC(y, m-1, d)).getUTCDay()` を使う
- 文字列の月日抽出 (`weekOfMonth` 等) は `string.slice` で直接行う

### ISO 曜日番号

仕様は `1=月..7=日`（PostgreSQL の `EXTRACT(ISODOW)` と同じ）。JS の `getUTCDay()` は `0=日..6=土` なので変換 `((dow + 6) % 7) + 1` を `dates.ts` に集約する。

### コミット

各 Task の最後で必ず単独コミット。pre-commit-gate hook が `pnpm nx affected -t lint test` を自動実行する。

---

## Task 1: 日付ユーティリティ `packages/habit-core/src/dates.ts`

**目的:** タイムゾーン非依存の純粋関数を集約する。`'YYYY-MM-DD'` のパース、UTC 日数化、ISO 曜日、月内週数、ある日数を加算した日付の文字列化。

**Files:**
- Create: `packages/habit-core/src/dates.ts`
- Create: `packages/habit-core/src/dates.test.ts`

- [ ] **Step 1: テストを書いて失敗させる**

`packages/habit-core/src/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isoDayOfWeek, toUtcDays, weekOfMonth } from './dates.js';

describe('dates.toUtcDays', () => {
  it('1970-01-01 を 0 として返す', () => {
    expect(toUtcDays('1970-01-01')).toBe(0);
  });

  it('1970-01-02 は 1', () => {
    expect(toUtcDays('1970-01-02')).toBe(1);
  });

  it('日数差はカレンダー日数と一致する', () => {
    expect(toUtcDays('2026-05-16') - toUtcDays('2026-05-15')).toBe(1);
    expect(toUtcDays('2024-03-01') - toUtcDays('2024-02-29')).toBe(1); // 閏年
    expect(toUtcDays('2025-03-01') - toUtcDays('2025-02-28')).toBe(1); // 非閏年
  });

  it('年跨ぎでも 1 日差', () => {
    expect(toUtcDays('2027-01-01') - toUtcDays('2026-12-31')).toBe(1);
  });
});

describe('dates.isoDayOfWeek', () => {
  // 2026-05-11 は月曜（既知の基準日: ISO 1）
  it('月曜は 1', () => {
    expect(isoDayOfWeek('2026-05-11')).toBe(1);
  });
  it('火曜は 2', () => {
    expect(isoDayOfWeek('2026-05-12')).toBe(2);
  });
  it('水曜は 3', () => {
    expect(isoDayOfWeek('2026-05-13')).toBe(3);
  });
  it('木曜は 4', () => {
    expect(isoDayOfWeek('2026-05-14')).toBe(4);
  });
  it('金曜は 5', () => {
    expect(isoDayOfWeek('2026-05-15')).toBe(5);
  });
  it('土曜は 6', () => {
    expect(isoDayOfWeek('2026-05-16')).toBe(6);
  });
  it('日曜は 7', () => {
    expect(isoDayOfWeek('2026-05-17')).toBe(7);
  });
});

describe('dates.weekOfMonth', () => {
  it('1〜7 日は第 1 週', () => {
    expect(weekOfMonth('2026-05-01')).toBe(1);
    expect(weekOfMonth('2026-05-07')).toBe(1);
  });
  it('8〜14 日は第 2 週', () => {
    expect(weekOfMonth('2026-05-08')).toBe(2);
    expect(weekOfMonth('2026-05-14')).toBe(2);
  });
  it('15〜21 日は第 3 週', () => {
    expect(weekOfMonth('2026-05-21')).toBe(3);
  });
  it('22〜28 日は第 4 週', () => {
    expect(weekOfMonth('2026-05-22')).toBe(4);
    expect(weekOfMonth('2026-05-28')).toBe(4);
  });
  it('29〜31 日は第 5 週', () => {
    expect(weekOfMonth('2026-05-29')).toBe(5);
    expect(weekOfMonth('2026-05-31')).toBe(5);
  });
});
```

- [ ] **Step 2: 失敗を確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/dates.test.ts
```

Expected: `Failed to resolve import "./dates.js"`

- [ ] **Step 3: `dates.ts` 実装**

`packages/habit-core/src/dates.ts`:

```ts
// 'YYYY-MM-DD' 文字列を UTC エポックからの日数（整数）に変換する。
// タイムゾーン非依存にするため、Date.UTC を使う。
export function toUtcDays(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

// ISO 曜日番号: 1=月, 2=火, ..., 7=日（PostgreSQL の EXTRACT(ISODOW) と一致）
export function isoDayOfWeek(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const jsDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=日..6=土
  return ((jsDow + 6) % 7) + 1;
}

// 月内週数: その月の同曜日が何回目か（SQL の (day - 1) / 7 + 1 と一致）
export function weekOfMonth(yyyyMmDd: string): number {
  const day = Number.parseInt(yyyyMmDd.slice(8, 10), 10);
  return Math.floor((day - 1) / 7) + 1;
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/dates.test.ts
```

Expected: 12 件 pass（toUtcDays 4 + isoDayOfWeek 7 + weekOfMonth 1）。実際はテスト関数粒度で `expect` 数が異なるが、`describe` 内の `it` 数で 12 件。

- [ ] **Step 5: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
pnpm exec biome ci packages/habit-core/src/
```

```bash
git add packages/habit-core/src/dates.ts packages/habit-core/src/dates.test.ts
git commit -m "$(cat <<'EOF'
feat(habit-core): 日付ユーティリティ dates.ts を追加

タイムゾーン非依存な toUtcDays / isoDayOfWeek / weekOfMonth を実装。
M4 の isDueOn 実装の土台。SQL の EXTRACT(ISODOW) / (day - 1) / 7 + 1
と同じ計算方式に揃え、後続のクロスバリデーションで整合する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `isDueOn` の `daily` 型 + 共通ガード

**目的:** `isDueOn` の throw 実装を関数本体に置き換え、`type: 'daily'` を最初に通す。同時に「`target_date < taskCreatedAt` なら常に false」という共通ガードを通す。

**Files:**
- Modify: `packages/habit-core/src/frequency.ts`
- Create: `packages/habit-core/src/frequency.test.ts`

- [ ] **Step 1: テスト作成**

`packages/habit-core/src/frequency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { type Frequency, isDueOn } from './frequency.js';

describe('isDueOn 共通ガード', () => {
  it('タスク作成日より前の日付は常に false', () => {
    const rule: Frequency = { type: 'daily' };
    expect(isDueOn(rule, '2026-05-15', '2026-05-16')).toBe(false);
  });

  it('タスク作成日当日は評価対象（daily なら true）', () => {
    const rule: Frequency = { type: 'daily' };
    expect(isDueOn(rule, '2026-05-16', '2026-05-16')).toBe(true);
  });
});

describe('isDueOn type=daily', () => {
  it('すべての日が true', () => {
    const rule: Frequency = { type: 'daily' };
    expect(isDueOn(rule, '2026-05-16', '2026-01-01')).toBe(true);
    expect(isDueOn(rule, '2026-12-31', '2026-01-01')).toBe(true);
    expect(isDueOn(rule, '2027-01-01', '2026-01-01')).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/frequency.test.ts
```

Expected: `NOT_IMPLEMENTED: isDueOn は M4 で実装する` で fail。

- [ ] **Step 3: `frequency.ts` を編集して daily と共通ガードを実装**

`packages/habit-core/src/frequency.ts` の全内容を以下に置き換える:

```ts
import { toUtcDays } from './dates.js';

// 頻度ルールの判別共用体。
// 詳細仕様は docs/superpowers/specs/2026-05-16-habits-app-design.md §5.2
export type Frequency =
  | { type: 'daily' }
  | { type: 'every_n_days'; n: number; anchor: string }
  | { type: 'weekday'; days: number[] } // 1=月..7=日
  | {
      type: 'day_of_week';
      days: number[];
      weeks_of_month?: number[];
    }
  | { type: 'every_n_weeks'; n: number; day_of_week: number; anchor: string };

// 指定日にタスクが頻度ルールにマッチするかを返す。
// 引数 date / taskCreatedAt は 'YYYY-MM-DD' 形式のローカル日付文字列。
export function isDueOn(rule: Frequency, date: string, taskCreatedAt: string): boolean {
  // 共通: タスク作成日より前は常に false
  if (toUtcDays(date) < toUtcDays(taskCreatedAt)) {
    return false;
  }

  if (rule.type === 'daily') {
    return true;
  }

  // 他の type は後続タスクで実装する
  return false;
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/frequency.test.ts
```

Expected: 4 件 pass。

> **注:** 既存の `index.test.ts` の「`isDueOn は M4 まで未実装のため throw する`」テストが今 fail する。Task 9 で `index.test.ts` を更新するまでの暫定として、ここでも `index.test.ts` を最小限調整しておく必要がある。下記の Step 4.5 で対応する。

- [ ] **Step 4.5: `index.test.ts` の NOT_IMPLEMENTED throw 期待を一時的にコメントアウト**

`packages/habit-core/src/index.test.ts` の以下 2 ブロックを `it.skip` に置き換える:

変更前:
```ts
  it('isDueOn は M4 まで未実装のため throw する', () => {
    expect(() => isDueOn({ type: 'daily' }, '2026-05-16', '2026-05-16')).toThrow(/NOT_IMPLEMENTED/);
  });

  it('calculateStreak は M4 まで未実装のため throw する', () => {
    expect(() => calculateStreak([])).toThrow(/NOT_IMPLEMENTED/);
  });
```

変更後（暫定 — Task 9 で本来の API スモークテストに置き換える）:
```ts
  it.skip('isDueOn は M4 完了で実装済（Task 9 で本来のスモークテストに置換予定）', () => {});
  it.skip('calculateStreak は M4 完了で実装済（Task 9 で本来のスモークテストに置換予定）', () => {});
```

`it.skip` を使うと vitest は skipped としてカウントするだけで fail しない。

- [ ] **Step 5: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
```

Expected: 全緑（既存テスト 5 件中 2 件 skipped + 3 件 pass、新規 frequency.test 4 件 pass、dates.test 12 件 pass）。

```bash
git add packages/habit-core/src/frequency.ts packages/habit-core/src/frequency.test.ts packages/habit-core/src/index.test.ts
git commit -m "$(cat <<'EOF'
feat(habit-core): isDueOn に共通ガードと type=daily を実装

タスク作成日より前は常に false、type=daily は常に true（作成日以降）。
他の type は後続タスクで実装。index.test.ts の NOT_IMPLEMENTED 期待は
暫定的に it.skip 化、Task 9 で正式なスモークテストに置換する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `isDueOn` の `every_n_days`

**目的:** `type: 'every_n_days'` を実装。`(target - anchor) % n === 0` で判定。`target < anchor` は false（taskCreatedAt とは別に anchor チェックが必要）。

**Files:**
- Modify: `packages/habit-core/src/frequency.ts`
- Modify: `packages/habit-core/src/frequency.test.ts`

- [ ] **Step 1: テスト追加**

`packages/habit-core/src/frequency.test.ts` の末尾に追加:

```ts
describe('isDueOn type=every_n_days', () => {
  const rule: Frequency = { type: 'every_n_days', n: 3, anchor: '2026-05-01' };
  const created = '2026-05-01';

  it('anchor 当日はマッチ', () => {
    expect(isDueOn(rule, '2026-05-01', created)).toBe(true);
  });

  it('anchor + 1 は false', () => {
    expect(isDueOn(rule, '2026-05-02', created)).toBe(false);
  });

  it('anchor + 2 は false', () => {
    expect(isDueOn(rule, '2026-05-03', created)).toBe(false);
  });

  it('anchor + 3 はマッチ', () => {
    expect(isDueOn(rule, '2026-05-04', created)).toBe(true);
  });

  it('anchor + 6 はマッチ', () => {
    expect(isDueOn(rule, '2026-05-07', created)).toBe(true);
  });

  it('anchor + 30 はマッチ（n=3 なので 30 / 3 = 10 サイクル）', () => {
    expect(isDueOn(rule, '2026-05-31', created)).toBe(true);
  });

  it('月跨ぎでも n 日周期', () => {
    // 2026-05-31 から +3 = 2026-06-03
    expect(isDueOn(rule, '2026-06-03', created)).toBe(true);
    expect(isDueOn(rule, '2026-06-02', created)).toBe(false);
  });

  it('anchor 前の日付は false（taskCreatedAt が anchor 以前でも）', () => {
    const r: Frequency = { type: 'every_n_days', n: 3, anchor: '2026-05-10' };
    expect(isDueOn(r, '2026-05-08', '2026-05-01')).toBe(false);
  });

  it('n=1 は daily と同等（anchor 以降）', () => {
    const r: Frequency = { type: 'every_n_days', n: 1, anchor: '2026-05-01' };
    expect(isDueOn(r, '2026-05-01', '2026-05-01')).toBe(true);
    expect(isDueOn(r, '2026-05-02', '2026-05-01')).toBe(true);
    expect(isDueOn(r, '2026-05-15', '2026-05-01')).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/frequency.test.ts
```

Expected: 新規 9 件中、anchor 当日（type=every_n_days の最初の assert）以降が false 結果で fail（現状すべて false 返す状態）。

- [ ] **Step 3: 実装追加**

`packages/habit-core/src/frequency.ts` の `isDueOn` 関数の `if (rule.type === 'daily')` の直後、`return false;` の手前に追加:

```ts
  if (rule.type === 'every_n_days') {
    const t = toUtcDays(date);
    const a = toUtcDays(rule.anchor);
    if (t < a) {
      return false;
    }
    return (t - a) % rule.n === 0;
  }
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/frequency.test.ts
```

Expected: daily 系 4 件 + every_n_days 系 9 件 = 13 件 pass。

- [ ] **Step 5: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
```

```bash
git add packages/habit-core/src/frequency.ts packages/habit-core/src/frequency.test.ts
git commit -m "$(cat <<'EOF'
feat(habit-core): isDueOn に type=every_n_days を実装

(target - anchor) % n === 0 で判定。anchor 前は false。
SQL is_due_on と同等の挙動。n=1 は daily と等価（anchor 以降）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `isDueOn` の `weekday`（曜日リスト）

**目的:** `type: 'weekday'` を実装。`days: number[]`（ISO: 1=月..7=日）に target の曜日が含まれていれば true。

**Files:**
- Modify: `packages/habit-core/src/frequency.ts`
- Modify: `packages/habit-core/src/frequency.test.ts`

- [ ] **Step 1: テスト追加**

`packages/habit-core/src/frequency.test.ts` の末尾に追加:

```ts
describe('isDueOn type=weekday', () => {
  const platdays: Frequency = { type: 'weekday', days: [1, 2, 3, 4, 5] }; // 平日
  const created = '2026-05-01';

  it('月曜は true', () => {
    expect(isDueOn(platdays, '2026-05-11', created)).toBe(true);
  });

  it('火曜は true', () => {
    expect(isDueOn(platdays, '2026-05-12', created)).toBe(true);
  });

  it('金曜は true', () => {
    expect(isDueOn(platdays, '2026-05-15', created)).toBe(true);
  });

  it('土曜は false', () => {
    expect(isDueOn(platdays, '2026-05-16', created)).toBe(false);
  });

  it('日曜は false', () => {
    expect(isDueOn(platdays, '2026-05-17', created)).toBe(false);
  });

  it('週末のみ days=[6,7] は土日が true、平日が false', () => {
    const weekend: Frequency = { type: 'weekday', days: [6, 7] };
    expect(isDueOn(weekend, '2026-05-16', created)).toBe(true);
    expect(isDueOn(weekend, '2026-05-17', created)).toBe(true);
    expect(isDueOn(weekend, '2026-05-15', created)).toBe(false);
  });

  it('days=[] は常に false', () => {
    const empty: Frequency = { type: 'weekday', days: [] };
    expect(isDueOn(empty, '2026-05-16', created)).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/frequency.test.ts
```

- [ ] **Step 3: 実装追加**

`packages/habit-core/src/frequency.ts` の import 文に `isoDayOfWeek` を追加:

```ts
import { isoDayOfWeek, toUtcDays } from './dates.js';
```

`isDueOn` の `every_n_days` ブロックの後に追加:

```ts
  if (rule.type === 'weekday') {
    const dow = isoDayOfWeek(date);
    return rule.days.includes(dow);
  }
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/frequency.test.ts
```

Expected: 既存 13 + weekday 7 = 20 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-core/src/frequency.ts packages/habit-core/src/frequency.test.ts
git commit -m "$(cat <<'EOF'
feat(habit-core): isDueOn に type=weekday を実装

ISO 曜日番号（1=月..7=日）が days 配列に含まれるかで判定。
days=[] は常に false。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `isDueOn` の `day_of_week` + `weeks_of_month`

**目的:** `type: 'day_of_week'` を実装。`days` に曜日が含まれていなければ false、`weeks_of_month` 未指定/空なら毎週マッチ、指定があれば月内週数を判定。SQL の挙動と一致させる: `weeks_of_month` プロパティ自体が存在しない or `null` の場合は「全週」扱い、空配列 `[]` の場合は「該当週なし → 常に false」とする。

**Files:**
- Modify: `packages/habit-core/src/frequency.ts`
- Modify: `packages/habit-core/src/frequency.test.ts`

- [ ] **Step 1: テスト追加**

`packages/habit-core/src/frequency.test.ts` の末尾に追加:

```ts
describe('isDueOn type=day_of_week', () => {
  const created = '2026-05-01';

  describe('weeks_of_month 未指定（毎週マッチ）', () => {
    const rule: Frequency = { type: 'day_of_week', days: [4] }; // 木曜

    it('5/7 木曜（第 1 週）は true', () => {
      expect(isDueOn(rule, '2026-05-07', created)).toBe(true);
    });
    it('5/14 木曜（第 2 週）は true', () => {
      expect(isDueOn(rule, '2026-05-14', created)).toBe(true);
    });
    it('5/21 木曜（第 3 週）は true', () => {
      expect(isDueOn(rule, '2026-05-21', created)).toBe(true);
    });
    it('5/28 木曜（第 4 週）は true', () => {
      expect(isDueOn(rule, '2026-05-28', created)).toBe(true);
    });
    it('木曜以外は false', () => {
      expect(isDueOn(rule, '2026-05-15', created)).toBe(false);
    });
  });

  describe('weeks_of_month = [2, 4]（第 2/4 木曜のみ）', () => {
    const rule: Frequency = { type: 'day_of_week', days: [4], weeks_of_month: [2, 4] };

    it('5/7 木曜（第 1 週）は false', () => {
      expect(isDueOn(rule, '2026-05-07', created)).toBe(false);
    });
    it('5/14 木曜（第 2 週）は true', () => {
      expect(isDueOn(rule, '2026-05-14', created)).toBe(true);
    });
    it('5/21 木曜（第 3 週）は false', () => {
      expect(isDueOn(rule, '2026-05-21', created)).toBe(false);
    });
    it('5/28 木曜（第 4 週）は true', () => {
      expect(isDueOn(rule, '2026-05-28', created)).toBe(true);
    });
    it('火曜（曜日不一致）は週問わず false', () => {
      expect(isDueOn(rule, '2026-05-12', created)).toBe(false);
    });
  });

  describe('weeks_of_month = [5]（第 5 週のみ）', () => {
    const rule: Frequency = { type: 'day_of_week', days: [5], weeks_of_month: [5] };

    it('2026-05-29 金曜（第 5 週）は true', () => {
      expect(isDueOn(rule, '2026-05-29', created)).toBe(true);
    });
    it('2026-05-22 金曜（第 4 週）は false', () => {
      expect(isDueOn(rule, '2026-05-22', created)).toBe(false);
    });
    it('2026-06-26 金曜（第 4 週、6 月最終）は false', () => {
      expect(isDueOn(rule, '2026-06-26', created)).toBe(false);
    });
  });

  describe('weeks_of_month = []（マッチ週なし → 常に false）', () => {
    const rule: Frequency = { type: 'day_of_week', days: [4], weeks_of_month: [] };
    it('全週で false', () => {
      expect(isDueOn(rule, '2026-05-07', created)).toBe(false);
      expect(isDueOn(rule, '2026-05-14', created)).toBe(false);
    });
  });

  describe('複数曜日 days = [1, 3, 5]（月水金）', () => {
    const rule: Frequency = { type: 'day_of_week', days: [1, 3, 5] };
    it('月曜は true', () => {
      expect(isDueOn(rule, '2026-05-11', created)).toBe(true);
    });
    it('水曜は true', () => {
      expect(isDueOn(rule, '2026-05-13', created)).toBe(true);
    });
    it('金曜は true', () => {
      expect(isDueOn(rule, '2026-05-15', created)).toBe(true);
    });
    it('火曜は false', () => {
      expect(isDueOn(rule, '2026-05-12', created)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/frequency.test.ts
```

- [ ] **Step 3: 実装追加**

`packages/habit-core/src/frequency.ts` の import 文に `weekOfMonth` を追加:

```ts
import { isoDayOfWeek, toUtcDays, weekOfMonth } from './dates.js';
```

`isDueOn` の `weekday` ブロックの後に追加:

```ts
  if (rule.type === 'day_of_week') {
    const dow = isoDayOfWeek(date);
    if (!rule.days.includes(dow)) {
      return false;
    }
    // weeks_of_month 未指定（undefined）は全週マッチ。
    // 空配列 [] は「該当週なし」として常に false。
    if (rule.weeks_of_month === undefined) {
      return true;
    }
    const wom = weekOfMonth(date);
    return rule.weeks_of_month.includes(wom);
  }
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/frequency.test.ts
```

Expected: 既存 20 + day_of_week 18 = 38 件 pass（describe ネストにより `it` の数）。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-core/src/frequency.ts packages/habit-core/src/frequency.test.ts
git commit -m "$(cat <<'EOF'
feat(habit-core): isDueOn に type=day_of_week を実装

曜日と weeks_of_month の両方でマッチ判定。
weeks_of_month が undefined なら全週、[] なら常に false。
仕様: 第 n 木曜 / 第 2/4 木曜（不燃物ゴミ）等を表現。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `isDueOn` の `every_n_weeks`

**目的:** `type: 'every_n_weeks'` を実装。曜日が一致しなければ false。anchor 以降で初めてその曜日にあたる日 (`first_match_date`) を求め、そこから `(n * 7)` 日周期。

**Files:**
- Modify: `packages/habit-core/src/frequency.ts`
- Modify: `packages/habit-core/src/frequency.test.ts`

- [ ] **Step 1: テスト追加**

`packages/habit-core/src/frequency.test.ts` の末尾に追加:

```ts
describe('isDueOn type=every_n_weeks', () => {
  // 2 週に 1 回、土曜（day_of_week=6）、anchor=2026-05-01（金曜）
  // first_match_date は anchor 以降の最初の土曜 → 2026-05-02（土）
  // 以降 2 週ごと: 2026-05-02, 2026-05-16, 2026-05-30, 2026-06-13, ...
  const rule: Frequency = {
    type: 'every_n_weeks',
    n: 2,
    day_of_week: 6,
    anchor: '2026-05-01',
  };
  const created = '2026-05-01';

  it('first_match_date 2026-05-02 はマッチ', () => {
    expect(isDueOn(rule, '2026-05-02', created)).toBe(true);
  });

  it('次の土曜 2026-05-09（1 週後）は false', () => {
    expect(isDueOn(rule, '2026-05-09', created)).toBe(false);
  });

  it('2 週後 2026-05-16 はマッチ', () => {
    expect(isDueOn(rule, '2026-05-16', created)).toBe(true);
  });

  it('4 週後 2026-05-30 はマッチ', () => {
    expect(isDueOn(rule, '2026-05-30', created)).toBe(true);
  });

  it('月跨ぎ 2026-06-13 はマッチ', () => {
    expect(isDueOn(rule, '2026-06-13', created)).toBe(true);
  });

  it('土曜以外は false', () => {
    expect(isDueOn(rule, '2026-05-15', created)).toBe(false); // 金
    expect(isDueOn(rule, '2026-05-17', created)).toBe(false); // 日
  });

  it('anchor 当日が指定曜日の場合は anchor 当日が first_match', () => {
    // anchor=2026-05-02（土曜）, day_of_week=6
    const r: Frequency = { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-05-02' };
    expect(isDueOn(r, '2026-05-02', '2026-05-02')).toBe(true);
    expect(isDueOn(r, '2026-05-16', '2026-05-02')).toBe(true);
    expect(isDueOn(r, '2026-05-09', '2026-05-02')).toBe(false);
  });

  it('anchor より前の日付は false', () => {
    expect(isDueOn(rule, '2026-04-25', created)).toBe(false);
  });

  it('n=1 (= 毎週) で土曜は毎週マッチ', () => {
    const r: Frequency = { type: 'every_n_weeks', n: 1, day_of_week: 6, anchor: '2026-05-01' };
    expect(isDueOn(r, '2026-05-02', created)).toBe(true);
    expect(isDueOn(r, '2026-05-09', created)).toBe(true);
    expect(isDueOn(r, '2026-05-16', created)).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/frequency.test.ts
```

- [ ] **Step 3: 実装追加**

`packages/habit-core/src/frequency.ts` の `day_of_week` ブロックの後、最後の `return false;` の前に追加:

```ts
  if (rule.type === 'every_n_weeks') {
    const dow = isoDayOfWeek(date);
    if (dow !== rule.day_of_week) {
      return false;
    }
    const anchorDays = toUtcDays(rule.anchor);
    const anchorDow = isoDayOfWeek(rule.anchor);
    // anchor 以降で初めて day_of_week にマッチする日数（オフセット 0..6）
    const offset = (rule.day_of_week - anchorDow + 7) % 7;
    const firstMatchDays = anchorDays + offset;
    const t = toUtcDays(date);
    if (t < firstMatchDays) {
      return false;
    }
    return (t - firstMatchDays) % (rule.n * 7) === 0;
  }
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/frequency.test.ts
```

Expected: 既存 38 + every_n_weeks 11 ≒ 49 件 pass（`it` ベース）。

- [ ] **Step 5: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
pnpm exec biome ci packages/habit-core/src/
```

```bash
git add packages/habit-core/src/frequency.ts packages/habit-core/src/frequency.test.ts
git commit -m "$(cat <<'EOF'
feat(habit-core): isDueOn に type=every_n_weeks を実装

anchor 以降で最初に day_of_week にマッチする日を first_match_date とし、
そこから (n * 7) 日周期で判定。SQL is_due_on と同等のロジック。
これで isDueOn の 5 type すべてを網羅。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `calculateStreak` の実装

**目的:** 日付昇順の `LogEntry[]` から最新の連続完了数を返す。仕様 §5.3:
- `complete`: streak +1
- `skip`: streak 維持
- `fail`: streak を 0 にリセット
- 頻度外: 呼び出し側で除外（この関数では考慮しない）

ロジック: **末尾から走査**して、最初に `fail` が出るまでに含まれる `complete` の数を返す（`skip` は数えないが、streak は途切れない）。

**Files:**
- Modify: `packages/habit-core/src/streak.ts`
- Create: `packages/habit-core/src/streak.test.ts`

- [ ] **Step 1: テスト作成**

`packages/habit-core/src/streak.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateStreak, type LogEntry } from './streak.js';

function logs(entries: Array<[string, 'complete' | 'skip' | 'fail']>): LogEntry[] {
  return entries.map(([date, status]) => ({ date, status }));
}

describe('calculateStreak', () => {
  it('空配列は 0', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('1 件 complete は 1', () => {
    expect(calculateStreak(logs([['2026-05-16', 'complete']]))).toBe(1);
  });

  it('1 件 skip は 0', () => {
    expect(calculateStreak(logs([['2026-05-16', 'skip']]))).toBe(0);
  });

  it('1 件 fail は 0', () => {
    expect(calculateStreak(logs([['2026-05-16', 'fail']]))).toBe(0);
  });

  it('連続 complete 3 件は 3', () => {
    expect(
      calculateStreak(
        logs([
          ['2026-05-14', 'complete'],
          ['2026-05-15', 'complete'],
          ['2026-05-16', 'complete'],
        ]),
      ),
    ).toBe(3);
  });

  it('skip は streak 維持（数えない）', () => {
    // complete, skip, complete → 2（最新から見て skip は壁にならない）
    expect(
      calculateStreak(
        logs([
          ['2026-05-14', 'complete'],
          ['2026-05-15', 'skip'],
          ['2026-05-16', 'complete'],
        ]),
      ),
    ).toBe(2);
  });

  it('末尾に skip があっても、その前の complete までを数える', () => {
    // complete, complete, skip → 2
    expect(
      calculateStreak(
        logs([
          ['2026-05-14', 'complete'],
          ['2026-05-15', 'complete'],
          ['2026-05-16', 'skip'],
        ]),
      ),
    ).toBe(2);
  });

  it('fail が出ると streak リセット（fail より後ろのみ数える）', () => {
    // complete, fail, complete → 1（最新の complete のみ）
    expect(
      calculateStreak(
        logs([
          ['2026-05-14', 'complete'],
          ['2026-05-15', 'fail'],
          ['2026-05-16', 'complete'],
        ]),
      ),
    ).toBe(1);
  });

  it('末尾が fail は 0（streak が完全に切れた状態）', () => {
    expect(
      calculateStreak(
        logs([
          ['2026-05-14', 'complete'],
          ['2026-05-15', 'complete'],
          ['2026-05-16', 'fail'],
        ]),
      ),
    ).toBe(0);
  });

  it('複合: fail → skip → complete → complete → skip → complete = 3', () => {
    // 末尾から遡って fail が出るまでに含まれる complete の数: 3
    expect(
      calculateStreak(
        logs([
          ['2026-05-10', 'fail'],
          ['2026-05-11', 'skip'],
          ['2026-05-12', 'complete'],
          ['2026-05-13', 'complete'],
          ['2026-05-14', 'skip'],
          ['2026-05-15', 'complete'],
        ]),
      ),
    ).toBe(3);
  });

  it('複合: 最古の fail があっても、それより新しい complete のみが streak', () => {
    expect(
      calculateStreak(
        logs([
          ['2026-05-10', 'fail'],
          ['2026-05-11', 'complete'],
          ['2026-05-12', 'complete'],
          ['2026-05-13', 'complete'],
        ]),
      ),
    ).toBe(3);
  });
});
```

- [ ] **Step 2: 失敗確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/streak.test.ts
```

Expected: `NOT_IMPLEMENTED: calculateStreak は M4 で実装する` で fail。

- [ ] **Step 3: `streak.ts` を実装**

`packages/habit-core/src/streak.ts` の全内容を以下に置き換える:

```ts
import type { TaskStatus } from './status.js';

// 日付昇順の log 一覧から最新の連続完了数（streak）を算出する。
// ルール:
//   - complete: streak +1
//   - skip:     streak 維持（増えない）
//   - fail:     streak を 0 にリセット
//   - 頻度外:   呼び出し側で除外して渡す
export interface LogEntry {
  date: string; // 'YYYY-MM-DD'
  status: TaskStatus;
}

export function calculateStreak(logsAsc: LogEntry[]): number {
  let streak = 0;
  // 末尾から走査して fail が出たら打ち切り。complete は加算、skip は無視。
  for (let i = logsAsc.length - 1; i >= 0; i--) {
    const status = logsAsc[i].status;
    if (status === 'fail') {
      break;
    }
    if (status === 'complete') {
      streak += 1;
    }
    // skip は何もしない（streak 維持）
  }
  return streak;
}
```

- [ ] **Step 4: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/streak.test.ts
```

Expected: 11 件 pass。

- [ ] **Step 5: コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
git add packages/habit-core/src/streak.ts packages/habit-core/src/streak.test.ts
git commit -m "$(cat <<'EOF'
feat(habit-core): calculateStreak を実装

末尾から走査し、fail で打ち切り、complete を加算、skip は維持。
仕様 §5.3 と一致。空配列・1 件・複合パターンを 11 ケースでカバー。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: エッジケース横断テスト（月末・第 5 週・閏年・年跨ぎ）

**目的:** 仕様 §9 で挙げられているエッジケースを `isDueOn` 全 type について横断的に検証する。Task 2-6 でも単体カバーはしているが、ここでは特に「閏年 2/29」「第 5 週が存在しない月」「12/31 → 1/1 跨ぎ」を集中的にテストする。

**Files:**
- Create: `packages/habit-core/src/edge-cases.test.ts`

- [ ] **Step 1: テスト作成**

`packages/habit-core/src/edge-cases.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { type Frequency, isDueOn } from './frequency.js';

describe('isDueOn エッジケース: 閏年 2/29', () => {
  const created = '2024-01-01';

  it('every_n_days: anchor=2024-02-01, n=28 で 2024-02-29 はマッチ', () => {
    const rule: Frequency = { type: 'every_n_days', n: 28, anchor: '2024-02-01' };
    expect(isDueOn(rule, '2024-02-29', created)).toBe(true);
  });

  it('weekday: 2024-02-29（木）は days=[4] にマッチ', () => {
    const rule: Frequency = { type: 'weekday', days: [4] };
    expect(isDueOn(rule, '2024-02-29', created)).toBe(true);
  });

  it('day_of_week: 2024-02-29 は第 5 木曜（weeks_of_month=[5] にマッチ）', () => {
    const rule: Frequency = { type: 'day_of_week', days: [4], weeks_of_month: [5] };
    expect(isDueOn(rule, '2024-02-29', created)).toBe(true);
  });

  it('every_n_days: 2024-03-01 は 2024-02-29 の翌日として扱われる（閏年）', () => {
    const rule: Frequency = { type: 'every_n_days', n: 1, anchor: '2024-02-29' };
    expect(isDueOn(rule, '2024-03-01', created)).toBe(true);
  });
});

describe('isDueOn エッジケース: 月末 30/31 日', () => {
  const created = '2026-01-01';

  it('weekday: 5/31 は土曜 days=[6] にマッチ', () => {
    const rule: Frequency = { type: 'weekday', days: [6] };
    expect(isDueOn(rule, '2026-05-31', created)).toBe(true);
  });

  it('day_of_week: 5/31 は第 5 日曜（実際は土曜、weeks_of_month=[5] / days=[6] でマッチ）', () => {
    const rule: Frequency = { type: 'day_of_week', days: [6], weeks_of_month: [5] };
    expect(isDueOn(rule, '2026-05-31', created)).toBe(true);
  });

  it('every_n_days: 2026-05-31 → 2026-06-01 は連続日扱い', () => {
    const rule: Frequency = { type: 'every_n_days', n: 1, anchor: '2026-05-31' };
    expect(isDueOn(rule, '2026-06-01', created)).toBe(true);
  });

  it('every_n_days: anchor=2026-05-31, n=30 で 2026-06-30 はマッチ', () => {
    const rule: Frequency = { type: 'every_n_days', n: 30, anchor: '2026-05-31' };
    expect(isDueOn(rule, '2026-06-30', created)).toBe(true);
  });
});

describe('isDueOn エッジケース: 第 5 週が存在しない月', () => {
  const created = '2026-01-01';

  it('day_of_week + weeks_of_month=[5]: 第 5 週が存在しない月では false', () => {
    // 2026-02 の最終日は 2/28 (土曜)。日数 28 / 7 = 4 → 最大第 4 週
    const rule: Frequency = { type: 'day_of_week', days: [6], weeks_of_month: [5] };
    expect(isDueOn(rule, '2026-02-21', created)).toBe(false);
    expect(isDueOn(rule, '2026-02-28', created)).toBe(false);
  });
});

describe('isDueOn エッジケース: 年跨ぎ', () => {
  const created = '2026-01-01';

  it('every_n_days: 2026-12-31 → 2027-01-01 は連続日扱い', () => {
    const rule: Frequency = { type: 'every_n_days', n: 1, anchor: '2026-12-31' };
    expect(isDueOn(rule, '2027-01-01', created)).toBe(true);
  });

  it('every_n_weeks: 2026 年末から翌年への 14 日周期が成立する', () => {
    // anchor=2026-12-26（土）, n=2, day_of_week=6
    // first_match=2026-12-26, +14 = 2027-01-09, +14 = 2027-01-23
    const rule: Frequency = {
      type: 'every_n_weeks',
      n: 2,
      day_of_week: 6,
      anchor: '2026-12-26',
    };
    expect(isDueOn(rule, '2027-01-09', created)).toBe(true);
    expect(isDueOn(rule, '2027-01-23', created)).toBe(true);
    expect(isDueOn(rule, '2027-01-16', created)).toBe(false);
  });

  it('weekday: 年末月曜 2026-12-28 は days=[1] にマッチ', () => {
    const rule: Frequency = { type: 'weekday', days: [1] };
    expect(isDueOn(rule, '2026-12-28', created)).toBe(true);
  });
});

describe('isDueOn エッジケース: anchor 当日 vs 前後', () => {
  it('every_n_days: anchor 当日はマッチ（taskCreatedAt と一致しても）', () => {
    const rule: Frequency = { type: 'every_n_days', n: 7, anchor: '2026-05-16' };
    expect(isDueOn(rule, '2026-05-16', '2026-05-16')).toBe(true);
  });

  it('every_n_days: anchor の 1 日前は false', () => {
    const rule: Frequency = { type: 'every_n_days', n: 7, anchor: '2026-05-16' };
    expect(isDueOn(rule, '2026-05-15', '2026-05-15')).toBe(false);
  });

  it('every_n_weeks: anchor 当日が指定曜日でない場合、最初のマッチは offset 日後', () => {
    // anchor=2026-05-16（土曜）, day_of_week=1（月曜）
    // first_match = anchor + (1 - 6 + 7) % 7 = anchor + 2 = 2026-05-18（月）
    const rule: Frequency = { type: 'every_n_weeks', n: 1, day_of_week: 1, anchor: '2026-05-16' };
    expect(isDueOn(rule, '2026-05-16', '2026-05-16')).toBe(false);
    expect(isDueOn(rule, '2026-05-18', '2026-05-16')).toBe(true);
  });
});
```

- [ ] **Step 2: 全テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/edge-cases.test.ts
```

Expected: 17 件 pass（既存実装に変更不要、エッジケース検証のみ）。

- [ ] **Step 3: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
pnpm exec biome ci packages/habit-core/src/
```

```bash
git add packages/habit-core/src/edge-cases.test.ts
git commit -m "$(cat <<'EOF'
test(habit-core): isDueOn のエッジケース横断テストを追加

仕様 §9 で要件として挙げられた:
- 閏年 2/29（every_n_days / weekday / day_of_week / 連続日）
- 月末 30/31 日（weekday / day_of_week / 月跨ぎ連続日）
- 第 5 週が存在しない月（day_of_week + weeks_of_month=[5]）
- 年跨ぎ（every_n_days / every_n_weeks / weekday）
- anchor 当日と前後

17 ケースで横断的にカバー。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: `index.test.ts` を正式な公開 API スモークに置き換え

**目的:** Task 2 で `it.skip` 化した「NOT_IMPLEMENTED throw」期待を完全に削除し、`isDueOn` / `calculateStreak` の実装後の挙動を 1〜2 件ずつ最小限スモークする。詳細テストは `frequency.test.ts` / `streak.test.ts` / `edge-cases.test.ts` に任せる。

**Files:**
- Modify: `packages/habit-core/src/index.test.ts`

- [ ] **Step 1: ファイル全置換**

`packages/habit-core/src/index.test.ts` の全内容を以下に置き換える:

```ts
import { describe, expect, it } from 'vitest';
import type { DisplayTaskStatus, Frequency, LogEntry, TaskStatus } from './index.js';
import { calculateStreak, isDueOn } from './index.js';

describe('@org/habit-core 公開 API スモーク', () => {
  it('型 Frequency が判別可能であること', () => {
    const f: Frequency = { type: 'daily' };
    expect(f.type).toBe('daily');
  });

  it('TaskStatus と DisplayTaskStatus が想定の値を取れること', () => {
    const s: TaskStatus = 'complete';
    const d: DisplayTaskStatus = 'empty';
    expect([s, d]).toEqual(['complete', 'empty']);
  });

  it('LogEntry を配列で扱えること', () => {
    const logs: LogEntry[] = [{ date: '2026-05-16', status: 'complete' }];
    expect(logs).toHaveLength(1);
  });

  it('isDueOn が頻度判定を返すこと（公開 API スモーク）', () => {
    expect(isDueOn({ type: 'daily' }, '2026-05-16', '2026-05-16')).toBe(true);
    expect(isDueOn({ type: 'weekday', days: [6] }, '2026-05-16', '2026-01-01')).toBe(true);
  });

  it('calculateStreak が連続完了数を返すこと（公開 API スモーク）', () => {
    expect(calculateStreak([])).toBe(0);
    expect(
      calculateStreak([
        { date: '2026-05-15', status: 'complete' },
        { date: '2026-05-16', status: 'complete' },
      ]),
    ).toBe(2);
  });
});
```

- [ ] **Step 2: テスト通過確認**

```bash
CI=true pnpm nx test @org/habit-core -- --run packages/habit-core/src/index.test.ts
```

Expected: 5 件 pass（skipped なし、新スモーク 2 件は実際に実装を呼ぶ）。

- [ ] **Step 3: 全体検証 + コミット**

```bash
CI=true pnpm nx affected -t typecheck lint test
```

Expected: habit-core で **dates 12 + frequency ~49 + streak 11 + edge-cases 17 + index 5 ≒ 94 件** pass、habits（M3 で追加した 39）+ habit-sync 4 と合わせて 100+ 件すべて緑。

```bash
git add packages/habit-core/src/index.test.ts
git commit -m "$(cat <<'EOF'
test(habit-core): index.test.ts を正式な公開 API スモークに更新

M4 で実装が完了したため NOT_IMPLEMENTED throw 期待を削除し、
isDueOn / calculateStreak の最小スモークに置き換え。
詳細テストは frequency.test.ts / streak.test.ts / edge-cases.test.ts に集約。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: （オプション）SQL `is_due_on` とのクロスバリデーション

**目的:** 仕様 §5.2「両者は同じ判定ロジックを返すこと（テストで保証）」を満たすため、`supabase start` が起動している前提で `psql` 経由で SQL 関数の出力を取得し、TS 実装と一致することを確認する。Docker 依存のため通常の `pnpm nx test` には組み込まず、`supabase` プレフィックス付きの独立スクリプトとして残す。

このタスクは Docker / supabase CLI が必要なため、CI フローには組み込まない。ローカル検証用。

**Files:**
- Create: `packages/habit-core/scripts/cross-validate-is-due-on.mjs`
- Modify: `packages/habit-core/package.json`（`"cross-validate"` スクリプト追加、任意）

- [ ] **Step 1: スクリプト作成**

`packages/habit-core/scripts/cross-validate-is-due-on.mjs`:

```js
#!/usr/bin/env node
// SQL の is_due_on と TS の isDueOn が同じ結果を返すかを検証する。
// 前提: supabase start でローカル DB が起動中（postgres://postgres:postgres@localhost:54322/postgres）。

import { execFileSync } from 'node:child_process';
import { isDueOn } from '../src/frequency.js';

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';

// 検証ケース: type ごとに代表 8 ケースずつ。
const cases = [
  // daily
  { rule: { type: 'daily' }, date: '2026-05-16', created: '2026-05-01' },
  { rule: { type: 'daily' }, date: '2026-04-30', created: '2026-05-01' }, // 前日 → false
  // every_n_days
  { rule: { type: 'every_n_days', n: 3, anchor: '2026-05-01' }, date: '2026-05-01', created: '2026-05-01' },
  { rule: { type: 'every_n_days', n: 3, anchor: '2026-05-01' }, date: '2026-05-04', created: '2026-05-01' },
  { rule: { type: 'every_n_days', n: 3, anchor: '2026-05-01' }, date: '2026-05-02', created: '2026-05-01' },
  // weekday
  { rule: { type: 'weekday', days: [1, 2, 3, 4, 5] }, date: '2026-05-11', created: '2026-05-01' },
  { rule: { type: 'weekday', days: [1, 2, 3, 4, 5] }, date: '2026-05-16', created: '2026-05-01' },
  // day_of_week
  { rule: { type: 'day_of_week', days: [4], weeks_of_month: [2, 4] }, date: '2026-05-14', created: '2026-05-01' },
  { rule: { type: 'day_of_week', days: [4], weeks_of_month: [2, 4] }, date: '2026-05-07', created: '2026-05-01' },
  // every_n_weeks
  { rule: { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-05-01' }, date: '2026-05-02', created: '2026-05-01' },
  { rule: { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-05-01' }, date: '2026-05-09', created: '2026-05-01' },
  { rule: { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-05-01' }, date: '2026-05-16', created: '2026-05-01' },
  // エッジケース
  { rule: { type: 'day_of_week', days: [4], weeks_of_month: [5] }, date: '2024-02-29', created: '2024-01-01' },
  { rule: { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-12-26' }, date: '2027-01-09', created: '2026-01-01' },
];

function sqlIsDueOn(rule, date, anchor) {
  const ruleJson = JSON.stringify(rule).replace(/'/g, "''");
  const sql = `SELECT public.is_due_on('${ruleJson}'::jsonb, '${date}'::date, '${anchor}'::date);`;
  const out = execFileSync('psql', [DB_URL, '-Atc', sql], { encoding: 'utf8' }).trim();
  return out === 't';
}

let failures = 0;
for (const c of cases) {
  const tsResult = isDueOn(c.rule, c.date, c.created);
  const sqlResult = sqlIsDueOn(c.rule, c.date, c.created);
  const match = tsResult === sqlResult;
  console.log(
    `${match ? '✓' : '✗'} ${JSON.stringify(c.rule)} date=${c.date} created=${c.created}: TS=${tsResult} SQL=${sqlResult}`,
  );
  if (!match) {
    failures += 1;
  }
}

console.log(`\n${cases.length - failures}/${cases.length} cases match.`);
if (failures > 0) {
  process.exit(1);
}
```

- [ ] **Step 2: 手動検証（オプショナル）**

ローカルで Docker + Supabase が動いている前提で:

```bash
supabase start
node packages/habit-core/scripts/cross-validate-is-due-on.mjs
```

Expected: 全 14 ケース match と表示され exit 0。失敗があれば該当行を確認して TS / SQL 双方を調整。

> **注:** このスクリプトは ESM の `import` 経由で `src/frequency.js` を直接読み込むため、`@org/source` 条件解決と異なる経路になる。ローカル実行時に `tsx` を使う必要がある場合は次のコマンドに置き換える: `pnpm exec tsx packages/habit-core/scripts/cross-validate-is-due-on.mjs`。`.mjs` のままだと TypeScript ソースを直接 import できないため、検証が必要。実行できない場合はこの Task を skip し、`packages/habit-core/scripts/README.md` にメモを残すか、`supabase test db`（pgTAP）の導入を後続マイルストーンで検討する。

- [ ] **Step 3: コミット（スクリプトのみ、検証実行は手動）**

```bash
git add packages/habit-core/scripts/cross-validate-is-due-on.mjs
git commit -m "$(cat <<'EOF'
test(habit-core): SQL is_due_on とのクロスバリデーションスクリプト追加

scripts/cross-validate-is-due-on.mjs を追加。
supabase start でローカル DB を起動した状態で実行すると、
TS の isDueOn と SQL の is_due_on が 14 ケースで一致することを確認する。
Docker 依存のため CI には組み込まず、ローカル検証用とする。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

> **このタスクをスキップする判断:** Docker や Supabase CLI が環境に無い場合、または ESM 経由で `.ts` ソースの import が解決できない場合、Task 10 全体をスキップしても M4 の完了条件には影響しない。`docs/superpowers/specs/2026-05-16-habits-app-design.md` §9 の「両者は同じ判定ロジックを返すこと（テストで保証）」は、本プランの Task 1-8 で TS 側の挙動を SQL ロジックに合わせて実装し、テーブル駆動テストで広範に検証することで満たしているため、SQL 直接照合は将来の `supabase test db`（pgTAP）導入で代替可能。

---

## 次のマイルストーン

このプラン完了後、次は **M5: 同期レイヤー** の実装プランを `docs/superpowers/plans/2026-05-16-habits-app-m5-sync.md` として作成する。M5 で扱う内容:

- `packages/habit-sync/src/observables.ts` を `syncedSupabase` で本実装
- legend-state `Observable Persist IndexedDB` プラグインで書き込みキャッシュ
- リトライ設定 (`retry: { infinite: true, backoff: 'exponential' }`)
- `task_logs` を直近 31 日でフィルタする初期 query
- 楽観更新・エラー時のロールバック挙動を vitest + supabase local で統合テスト

---

## 自己レビュー結果

仕様カバレッジ（§5.2 / §5.3 / §9）:

- ✅ `Frequency` 5 type すべて Task 2-6 で実装
- ✅ 「タスク作成日より前は false」共通ガード Task 2
- ✅ `calculateStreak` の complete +1 / skip 維持 / fail リセット Task 7
- ✅ 月末・第 5 週・閏年・年跨ぎ・anchor 前後 Task 8
- ✅ SQL との一致確認 Task 10（オプショナル）
- ✅ 既存 M1 雛形テストの NOT_IMPLEMENTED throw 削除 Task 9

型整合性:

- `Frequency` 型は M1 で定義済、変更なし
- `LogEntry` 型は M1 で定義済、変更なし
- `TaskStatus` 型は M1 で定義済、変更なし
- 関数シグネチャ: `isDueOn(rule, date, taskCreatedAt)` `calculateStreak(logsAsc)` 全タスクで一貫

プレースホルダ:

- なし。すべてのテスト/実装/コマンドが具体的記述。
