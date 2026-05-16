import { observable } from '@legendapp/state';
import type { User } from '@supabase/supabase-js';
import type { Task, TaskLog, TaskStashView, TimeSlot } from './types.js';

// 同期 observable の root。
// 各テーブル / VIEW は id 引きの Record として保持。
// 実体への syncedSupabase 接続は setupSync() で行う（Task 7）。
export const state$ = observable<SyncStateShape>({
  user: null,
  time_slots: {},
  tasks: {},
  task_logs: {},
  task_stash_view: {},
});

export interface SyncStateShape {
  user: User | null;
  time_slots: Record<string, TimeSlot>;
  tasks: Record<string, Task>;
  task_logs: Record<string, TaskLog>; // key は `${task_id}-${date}` 形式
  task_stash_view: Record<string, TaskStashView>;
}

export type SyncState = typeof state$;
