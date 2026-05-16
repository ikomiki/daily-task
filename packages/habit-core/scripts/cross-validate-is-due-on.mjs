#!/usr/bin/env node
// SQL の is_due_on と TS の isDueOn が同じ結果を返すかを検証する。
// 前提: supabase start でローカル DB が起動中。
// 実行: node packages/habit-core/scripts/cross-validate-is-due-on.mjs
//
// 注: このスクリプトは TypeScript ソースを直接 import せず、
// TS 側で期待する真偽値を JS リテラルとして並記する。
// TS 実装は packages/habit-core/src/frequency.ts の isDueOn と
// テストファイル全体で別途検証済み（M4 Task 2-8）。
// このスクリプトは「SQL is_due_on が TS と同じ判定を返すか」のみを確認する。

import { execFileSync } from 'node:child_process';

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres';

// 検証ケース: type ごとに代表ケース。expected は TS 実装が返すべき値。
const cases = [
  // daily: 作成日以降は true
  { rule: { type: 'daily' }, date: '2026-05-16', created: '2026-05-01', expected: true },
  // daily: 作成日より前は false（共通ガード）
  { rule: { type: 'daily' }, date: '2026-04-30', created: '2026-05-01', expected: false },
  // every_n_days: anchor 当日は true
  {
    rule: { type: 'every_n_days', n: 3, anchor: '2026-05-01' },
    date: '2026-05-01',
    created: '2026-05-01',
    expected: true,
  },
  // every_n_days: 3 日後は true
  {
    rule: { type: 'every_n_days', n: 3, anchor: '2026-05-01' },
    date: '2026-05-04',
    created: '2026-05-01',
    expected: true,
  },
  // every_n_days: 1 日後は false
  {
    rule: { type: 'every_n_days', n: 3, anchor: '2026-05-01' },
    date: '2026-05-02',
    created: '2026-05-01',
    expected: false,
  },
  // weekday: 月曜（ISODOW=1）は平日リストに含まれる → true
  {
    rule: { type: 'weekday', days: [1, 2, 3, 4, 5] },
    date: '2026-05-11',
    created: '2026-05-01',
    expected: true,
  },
  // weekday: 土曜（ISODOW=6）は平日リストに含まれない → false
  {
    rule: { type: 'weekday', days: [1, 2, 3, 4, 5] },
    date: '2026-05-16',
    created: '2026-05-01',
    expected: false,
  },
  // day_of_week: 第 2 木曜（2026-05-14）は weeks_of_month=[2,4] にマッチ → true
  {
    rule: { type: 'day_of_week', days: [4], weeks_of_month: [2, 4] },
    date: '2026-05-14',
    created: '2026-05-01',
    expected: true,
  },
  // day_of_week: 第 1 木曜（2026-05-07）は weeks_of_month=[2,4] に不一致 → false
  {
    rule: { type: 'day_of_week', days: [4], weeks_of_month: [2, 4] },
    date: '2026-05-07',
    created: '2026-05-01',
    expected: false,
  },
  // every_n_weeks: anchor=2026-05-01（金）、day_of_week=6、n=2
  // 初回マッチ: 2026-05-02（土）→ true
  {
    rule: { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-05-01' },
    date: '2026-05-02',
    created: '2026-05-01',
    expected: true,
  },
  // every_n_weeks: 1 週後の土曜（2026-05-09）は偶数サイクルでないため → false
  {
    rule: { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-05-01' },
    date: '2026-05-09',
    created: '2026-05-01',
    expected: false,
  },
  // every_n_weeks: 2 週後の土曜（2026-05-16）は true
  {
    rule: { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-05-01' },
    date: '2026-05-16',
    created: '2026-05-01',
    expected: true,
  },
  // エッジケース: 閏年 2024-02-29 は第 5 木曜（ISODOW=4, nth=5）→ true
  {
    rule: { type: 'day_of_week', days: [4], weeks_of_month: [5] },
    date: '2024-02-29',
    created: '2024-01-01',
    expected: true,
  },
  // エッジケース: 年跨ぎ。anchor=2026-12-26（土）、n=2、day_of_week=6
  // 2027-01-09 は anchor から 14 日後の土曜 → true
  {
    rule: { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-12-26' },
    date: '2027-01-09',
    created: '2026-01-01',
    expected: true,
  },
];

/**
 * psql 経由で SQL の is_due_on を呼び出し、結果を boolean で返す。
 *
 * @param {object} rule - 頻度ルール（JSON シリアライズ可能なオブジェクト）
 * @param {string} date - 対象日（'YYYY-MM-DD'）
 * @param {string} anchor - anchor_date（タスク作成日に相当、'YYYY-MM-DD'）
 * @returns {boolean} SQL 関数の返値
 */
function sqlIsDueOn(rule, date, anchor) {
  const ruleJson = JSON.stringify(rule).replace(/'/g, "''");
  const sql = `SELECT public.is_due_on('${ruleJson}'::jsonb, '${date}'::date, '${anchor}'::date);`;
  const out = execFileSync('psql', [DB_URL, '-Atc', sql], { encoding: 'utf8' }).trim();
  return out === 't';
}

let failures = 0;
for (const c of cases) {
  const sqlResult = sqlIsDueOn(c.rule, c.date, c.created);
  const match = sqlResult === c.expected;
  const mark = match ? '✓' : '✗';
  console.log(
    `${mark} ${JSON.stringify(c.rule)} date=${c.date} created=${c.created}: SQL=${sqlResult} expected(TS)=${c.expected}`,
  );
  if (!match) {
    failures += 1;
  }
}

console.log(
  `\n${cases.length - failures}/${cases.length} cases match between SQL is_due_on and TS isDueOn (expected values).`,
);
if (failures > 0) {
  process.exit(1);
}
