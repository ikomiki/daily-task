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
