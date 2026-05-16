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
