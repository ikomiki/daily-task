import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './db-types.js';
import { state$ } from './observables.js';
import { getCurrentSupabaseClient } from './supabase.js';
import type { TaskStashView } from './types.js';

// task_stash_view の全行を Supabase から取得して state$ に反映する。
// VIEW は Realtime 非対応なため、スタッシュ画面マウント時に明示的に呼ぶことで
// task_logs の操作→トリガー→task_stash 更新の伝播遅延を吸収する。
export async function refreshTaskStashView(): Promise<void> {
  const client = getCurrentSupabaseClient();
  if (client === null) {
    return;
  }
  const typedClient = client as unknown as SupabaseClient<Database>;
  const { data } = await typedClient.from('task_stash_view').select('*');
  if (data) {
    for (const row of data) {
      state$.task_stash_view[row.task_id as string].set(row as TaskStashView);
    }
  }
}
