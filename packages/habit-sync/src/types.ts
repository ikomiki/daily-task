import type { Database } from './db-types.js';

// 4 テーブル / VIEW の Row 型をシンプル名で再エクスポート。
// 同期層のコンシューマー（apps/habits）はここから型を引く。

export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export type TimeSlot = Database['public']['Tables']['time_slots']['Row'];
export type TimeSlotInsert = Database['public']['Tables']['time_slots']['Insert'];
export type TimeSlotUpdate = Database['public']['Tables']['time_slots']['Update'];

export type TaskLog = Database['public']['Tables']['task_logs']['Row'];
export type TaskLogInsert = Database['public']['Tables']['task_logs']['Insert'];
export type TaskLogUpdate = Database['public']['Tables']['task_logs']['Update'];

export type TaskStashView = Database['public']['Views']['task_stash_view']['Row'];

export type TaskStatus = Database['public']['Enums']['task_status'];
