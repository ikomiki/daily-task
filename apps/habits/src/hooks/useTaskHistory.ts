import { use$ } from '@legendapp/state/react';
import { loadTaskHistory, state$, type TaskLog } from '@org/habit-sync';
import { useCallback, useEffect, useState } from 'react';
import { getAppSupabase } from '../lib/supabase.js';

export interface UseTaskHistoryResult {
  logs: TaskLog[]; // date 降順（最新が先頭）
  hasMore: boolean;
  isLoading: boolean;
  loadMore: () => Promise<void>;
}

const PAGE_SIZE = 31;

// 選択中タスクの履歴ログを返す。
// - 直近 31 日: state$.task_logs から該当 task_id を抽出
// - 32 日以前: loadMore() で Supabase から PAGE_SIZE 件ずつ追加取得
// - 取得結果が PAGE_SIZE 未満なら hasMore=false で打ち切り
export function useTaskHistory(taskId: string | null): UseTaskHistoryResult {
  const recentLogs = use$<TaskLog[]>(() => {
    if (taskId === null) {
      return [];
    }
    const all = Object.values(state$.task_logs.get()) as TaskLog[];
    return all.filter((l) => l.task_id === taskId).sort((a, b) => b.date.localeCompare(a.date));
  });

  const [pastLogs, setPastLogs] = useState<TaskLog[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // taskId が変わったらローカル state を完全リセット
  useEffect(() => {
    setPastLogs([]);
    setHasMore(true);
    setIsLoading(false);
  }, [taskId]);

  const logs: TaskLog[] = [...recentLogs, ...pastLogs];

  const loadMore = useCallback(async (): Promise<void> => {
    if (taskId === null || isLoading || !hasMore) {
      return;
    }
    const oldest = logs[logs.length - 1]?.date;
    if (oldest === undefined) {
      // 既存ログ無し → cursor が決まらないので打ち切り
      setHasMore(false);
      return;
    }
    setIsLoading(true);
    try {
      const batch = await loadTaskHistory(getAppSupabase(), {
        taskId,
        beforeDate: oldest,
        limit: PAGE_SIZE,
      });
      if (batch.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setPastLogs((prev) => [...prev, ...batch]);
    } finally {
      setIsLoading(false);
    }
  }, [taskId, isLoading, hasMore, logs]);

  // taskId が null のときは hasMore も false 扱い（fetch する対象が無いため）
  return { logs, hasMore: taskId === null ? false : hasMore, isLoading, loadMore };
}
