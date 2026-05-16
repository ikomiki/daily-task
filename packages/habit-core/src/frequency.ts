import { isoDayOfWeek, toUtcDays, weekOfMonth } from './dates.js';

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

  if (rule.type === 'every_n_days') {
    const t = toUtcDays(date);
    const a = toUtcDays(rule.anchor);
    if (t < a) {
      return false;
    }
    return (t - a) % rule.n === 0;
  }

  if (rule.type === 'weekday') {
    const dow = isoDayOfWeek(date);
    return rule.days.includes(dow);
  }

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

  // 他の type は後続タスクで実装する
  return false;
}
