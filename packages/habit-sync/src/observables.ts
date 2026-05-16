import { observable } from '@legendapp/state';
import type { User } from '@supabase/supabase-js';

// 同期 observable の root。
// M5 で syncedSupabase / IndexedDB 永続化を追加する。
// 現時点では型骨格のみで、実体は空オブジェクト。
export const state$ = observable({
  user: null as User | null,
  time_slots: {} as Record<string, unknown>,
  tasks: {} as Record<string, unknown>,
  task_logs: {} as Record<string, unknown>,
});

export type SyncState = typeof state$;
