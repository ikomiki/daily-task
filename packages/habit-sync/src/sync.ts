import type { Observable } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import { toUtcDays } from '@org/habit-core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './db-types.js';
import type { SyncStateShape } from './observables.js';

export interface SetupSyncOptions {
  today: string; // 'YYYY-MM-DD' — task_logs の filter cutoff 計算に使う
  realtime?: boolean; // Realtime 有効化フラグ（テスト時は false にして接続をスキップ）
}

// today から 31 日前の日付文字列を返す（task_logs の初期 filter 範囲）。
export function getTaskLogsCutoffDate(today: string): string {
  const days = toUtcDays(today) - 31;
  const ms = days * 86_400_000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// state$ の 4 テーブル / VIEW を syncedSupabase で双方向同期に接続する。
// アプリ起動時に 1 度だけ呼ぶ想定。
export function setupSync(
  state$: Observable<SyncStateShape>,
  client: SupabaseClient,
  options: SetupSyncOptions,
): void {
  const cutoff = getTaskLogsCutoffDate(options.today);
  // 明示的に false が渡された場合のみ無効。省略時（undefined）はデフォルト true。
  const rt = options.realtime !== false;

  // Database 型付きクライアントにキャストして syncedSupabase の型推論を通す。
  const typedClient = client as unknown as SupabaseClient<Database>;

  // time_slots: 全件同期、Realtime ON
  syncObservable(
    state$.time_slots,
    syncedSupabase({
      supabase: typedClient,
      collection: 'time_slots',
      realtime: rt,
      persist: { name: 'time_slots' },
    }),
  );

  // tasks: 全件同期、Realtime ON
  syncObservable(
    state$.tasks,
    syncedSupabase({
      supabase: typedClient,
      collection: 'tasks',
      realtime: rt,
      persist: { name: 'tasks' },
    }),
  );

  // task_logs: 直近 31 日のみ初期ロード、Realtime ON
  // 複合 PK (task_id, date) は fieldId で暫定対応
  syncObservable(
    state$.task_logs,
    syncedSupabase({
      supabase: typedClient,
      collection: 'task_logs',
      realtime: rt,
      filter: (q) => q.gte('date', cutoff),
      persist: { name: 'task_logs' },
      fieldId: 'task_id',
    }),
  );

  // task_stash_view: VIEW のため read-only、Realtime ON
  syncObservable(
    state$.task_stash_view,
    syncedSupabase({
      supabase: typedClient,
      collection: 'task_stash_view',
      realtime: rt,
      actions: ['read'],
      persist: { name: 'task_stash_view' },
      fieldId: 'task_id',
    }),
  );
}
