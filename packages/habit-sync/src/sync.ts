import { type Observable, whenReady } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import { toUtcDays } from '@org/habit-core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './db-types.js';
import type { SyncStateShape } from './observables.js';
import { online$ } from './online.js';
import type { TaskLog, TaskLogInsert, TaskStashView } from './types.js';

// IndexedDB persist plugin（@legendapp/state/persist-plugins/indexeddb）が
// 保存時に `value.id = key` と元オブジェクトをミューテートする副作用がある。
// task_logs は複合 PK (task_id, date) のため `id` カラムが存在せず、
// この `id` がそのまま Supabase に送信されると PGRST204 で拒否される。
// transform.save で送信直前に剥がして対処する。
export function stripPersistInjectedId<T extends Record<string, unknown>>(value: T): T {
  if (value && typeof value === 'object' && 'id' in value) {
    const { id: _injectedId, ...rest } = value;
    return rest as T;
  }
  return value;
}

// React Strict Mode では useEffect が 2 回走るため setupSync が同一 client で複数回呼ばれる。
// 同名 channel に対し subscribe() 済の状態で .on() を再度呼ぶと supabase-js が throw するので、
// クライアント単位で task_stash 購読を 1 回だけ確立するためのガード。
const taskStashSubscribedClients = new WeakSet<object>();

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

  // オフライン中は書き込みをキューし、オンライン復帰時に即送信する設定。
  // waitForSet: online$ により、online$ が true になるまで SET を保留する。
  // WebSocket 再接続タイミングでリトライタイマーがキャンセルされる問題を回避できる。
  // retry: infinite は Supabase 側エラー（レート制限等）への対処として引き続き使用する。
  // waitFor: state$.user が入るまで初回 GET と realtime subscribe を保留する。
  // これがないと未認証 GET → RLS で空配列 → ログイン後も再フェッチされず、
  // 「IndexedDB 削除後の初回ログイン直後はデータが出ない（リロードで出る）」という挙動になる。
  const waitForAuth = (): boolean => state$.user.get() !== null;
  const writeOptions = {
    waitFor: waitForAuth,
    waitForSet: online$,
    retry: { infinite: true },
  } as const;

  // time_slots: 全件同期、Realtime ON
  syncObservable(
    state$.time_slots,
    syncedSupabase({
      supabase: typedClient,
      collection: 'time_slots',
      realtime: rt,
      persist: { name: 'time_slots' },
      ...writeOptions,
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
      ...writeOptions,
    }),
  );

  // task_logs: 直近 31 日のみ初期ロード、Realtime ON
  // 複合 PK (task_id, date) のため create/update を upsert に統一する。
  // デフォルト実装は prevAtPath ベースで INSERT/UPDATE を振り分けるが、ブラウザ再起動・
  // IndexedDB 復元後にメモリ Map が空になると既存行に INSERT を投げて 23505 になる。
  // また delete の単一 fieldId 絞り込みは別日の同 task_id 行を誤削除するバグがある。
  syncObservable(
    state$.task_logs,
    syncedSupabase({
      supabase: typedClient,
      collection: 'task_logs',
      realtime: rt,
      filter: (q) => q.gte('date', cutoff),
      persist: { name: 'task_logs' },
      fieldId: 'task_id',
      ...writeOptions,
      transform: {
        save: (row) => stripPersistInjectedId(row as unknown as Record<string, unknown>) as TaskLog,
      },
      create: async (input) =>
        typedClient
          .from('task_logs')
          .upsert(input as TaskLogInsert, { onConflict: 'task_id,date' })
          .select()
          .single(),
      update: async (input) =>
        typedClient
          .from('task_logs')
          .upsert(input as TaskLogInsert, { onConflict: 'task_id,date' })
          .select()
          .single(),
      delete: async (input) =>
        typedClient
          .from('task_logs')
          .delete()
          .eq('task_id', input.task_id as string)
          .eq('date', input.date as string)
          .select()
          .single(),
    }),
  );

  // task_stash_view: VIEW のため read-only。
  // VIEW は supabase_realtime publication に登録できず postgres_changes が発火しないため、
  // syncedSupabase 側の realtime は無効化し、後段で task_stash テーブルを直接購読する。
  syncObservable(
    state$.task_stash_view,
    syncedSupabase({
      supabase: typedClient,
      collection: 'task_stash_view',
      realtime: false,
      actions: ['read'],
      persist: { name: 'task_stash_view' },
      fieldId: 'task_id',
      waitFor: waitForAuth,
      transform: {
        save: (row) =>
          stripPersistInjectedId(row as unknown as Record<string, unknown>) as TaskStashView,
      },
    }),
  );

  // task_stash テーブルの変更を購読し、対応する task_stash_view の行を再取得する。
  // task_stash は publication 登録済 (migration 10) のため postgres_changes が発火する。
  // task_logs 操作 → トリガー (migration 9) → task_stash UPDATE → ここで View を再フェッチ、の流れ。
  // 未認証で subscribe するとサーバ側で RLS が効かず以後のイベントが届かない可能性があるため、
  // syncedSupabase 側と揃えて state$.user が入るまで購読を保留する。
  if (rt && !taskStashSubscribedClients.has(typedClient)) {
    taskStashSubscribedClients.add(typedClient);
    void whenReady(waitForAuth, () => {
      typedClient
        .channel('task_stash_view_refresh')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'task_stash' },
          async (payload) => {
            const newRow = payload.new as { task_id?: string } | null | undefined;
            const oldRow = payload.old as { task_id?: string } | null | undefined;
            const taskId = newRow?.task_id ?? oldRow?.task_id;
            if (!taskId) {
              return;
            }
            const { data } = await typedClient
              .from('task_stash_view')
              .select('*')
              .eq('task_id', taskId)
              .maybeSingle();
            if (data) {
              state$.task_stash_view[taskId].set(data as TaskStashView);
            } else {
              state$.task_stash_view[taskId].delete();
            }
          },
        )
        .subscribe();
    });
  }
}
