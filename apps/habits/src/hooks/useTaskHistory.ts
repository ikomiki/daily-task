import { useValue } from '@legendapp/state/react';
import { loadTaskHistory, state$, type TaskLog } from '@org/habit-sync';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const recentLogs = useValue<TaskLog[]>(() => {
    if (taskId === null) {
      return [];
    }
    const all = Object.values(state$.task_logs.get()) as TaskLog[];
    return all.filter((l) => l.task_id === taskId).sort((a, b) => b.date.localeCompare(a.date));
  });

  const [pastLogs, setPastLogs] = useState<TaskLog[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  // 直近の fetch を識別する世代番号。taskId が変わると inc される。
  // in-flight 中に taskId が切り替わったら resolve 時に破棄して旧 taskId のデータ混入を防ぐ。
  const generationRef = useRef(0);

  // taskId が変わったらローカル state を完全リセット
  useEffect(() => {
    generationRef.current += 1;
    setPastLogs([]);
    setHasMore(true);
    setIsLoading(false);
  }, [taskId]);

  const logs: TaskLog[] = [...recentLogs, ...pastLogs];

  // loadMore は taskId/pastLogs/state$.task_logs に対する最新値を取り出すため、
  // 依存配列には primitive のみ含め、cursor は呼び出し時に都度計算する。
  const loadMore = useCallback(async (): Promise<void> => {
    if (taskId === null || isLoading || !hasMore) {
      return;
    }
    const myGeneration = generationRef.current;
    // cursor は最新の recent/past から都度導出（logs を deps にしないため）
    const currentRecent = (Object.values(state$.task_logs.get()) as TaskLog[])
      .filter((l) => l.task_id === taskId)
      .sort((a, b) => b.date.localeCompare(a.date));
    const oldest = pastLogs.at(-1)?.date ?? currentRecent.at(-1)?.date;
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
      // resolve 時点で taskId が切り替わっていたら破棄
      if (generationRef.current !== myGeneration) {
        return;
      }
      if (batch.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setPastLogs((prev) => [...prev, ...batch]);
    } finally {
      if (generationRef.current === myGeneration) {
        setIsLoading(false);
      }
    }
  }, [taskId, isLoading, hasMore, pastLogs]);

  // taskId が null のときは hasMore も false 扱い（fetch する対象が無いため）
  return { logs, hasMore: taskId === null ? false : hasMore, isLoading, loadMore };
}
