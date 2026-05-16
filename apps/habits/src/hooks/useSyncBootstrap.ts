import { configureSyncPersistence, setupSync, startOnlineWatcher, state$ } from '@org/habit-sync';
import { useEffect } from 'react';
import { getAppSupabase } from '../lib/supabase.js';

// アプリ起動時に同期レイヤーを初期化する。
// 1) IndexedDB 永続化を設定
// 2) navigator.onLine 監視を開始
// 3) 4 テーブルを syncedSupabase に接続
// App.tsx で 1 度だけ呼ぶ想定。
export function useSyncBootstrap(): void {
  useEffect(() => {
    configureSyncPersistence({
      databaseName: 'habits-cache',
      tableNames: ['tasks', 'time_slots', 'task_logs', 'task_stash_view'],
    });

    const stopOnlineWatcher = startOnlineWatcher();

    // today はクライアントローカル日付（YYYY-MM-DD）
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    setupSync(state$, getAppSupabase(), { today });

    return () => {
      stopOnlineWatcher();
    };
  }, []);
}
