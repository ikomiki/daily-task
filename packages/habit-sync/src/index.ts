// Supabase の TS 型（supabase gen types typescript --local で再生成可能）

export type { Session, User } from '@supabase/supabase-js';
export type { DisplayTaskStatus, TodayTaskGroup, TodayTaskItem } from './computed.js';
export { getTodayTasksView } from './computed.js';
export type { Database, Json } from './db-types.js';
export type { LoadTaskHistoryOptions } from './history.js';
export { loadTaskHistory } from './history.js';
export type {
  NotificationProvider,
  PermissionState,
  SlotSchedule,
} from './notify/NotificationProvider.js';
export type { SyncState } from './observables.js';
export { state$ } from './observables.js';
export { online$, startOnlineWatcher } from './online.js';
export { getPendingSyncCount } from './pending-sync.js';
export type { SyncPersistenceConfig } from './persist.js';
export { configureSyncPersistence } from './persist.js';
export type { SupabaseConfig } from './supabase.js';
export { getSupabaseClient, resetSupabaseClient } from './supabase.js';
export type { SetupSyncOptions } from './sync.js';
export { getTaskLogsCutoffDate, setupSync } from './sync.js';
export { clearTaskLogStatus, setTaskLogStatus, taskLogKey } from './task-log-write.js';
export type { CreateTaskInput, UpdateTaskInput } from './task-write.js';
export { archiveTask, createTask, unarchiveTask, updateTask } from './task-write.js';
export type {
  CreateTimeSlotInput,
  DeleteResult,
  UpdateTimeSlotInput,
} from './time-slot-write.js';
export { createTimeSlot, deleteTimeSlot, updateTimeSlot } from './time-slot-write.js';
export type {
  Task,
  TaskInsert,
  TaskLog,
  TaskLogInsert,
  TaskLogUpdate,
  TaskStashView,
  TaskStatus,
  TaskUpdate,
  TimeSlot,
  TimeSlotInsert,
  TimeSlotUpdate,
} from './types.js';
