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
