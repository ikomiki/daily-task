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
// 実装本体は M4（packages/habit-core 実装フェーズ）で行う。
// 引数 date / anchor は 'YYYY-MM-DD' 形式のローカル日付文字列。
export function isDueOn(_rule: Frequency, _date: string, _taskCreatedAt: string): boolean {
  throw new Error('NOT_IMPLEMENTED: isDueOn は M4 で実装する');
}
