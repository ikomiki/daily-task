import { use$ } from '@legendapp/state/react';
import { buildCalendarGrid, type Frequency, isDueOn, toUtcDays } from '@org/habit-core';
import {
  clearTaskLogStatus,
  type DisplayTaskStatus,
  getTaskLogsCutoffDate,
  refreshTaskStashView,
  setTaskLogStatus,
  state$,
  type Task,
  type TaskLog,
} from '@org/habit-sync';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadTaskLogsInRange } from '../lib/calendar-fetch-range.js';
import { nextCalendarStatus } from '../lib/calendar-status.js';
import { getAppSupabase } from '../lib/supabase.js';

export interface CalendarCellModel {
  date: string;
  isCurrentMonth: boolean;
  isDue: boolean;
  isFuture: boolean;
  isToday: boolean;
  status: DisplayTaskStatus;
}

export interface UseTaskCalendarResult {
  yearMonth: string;
  cells: CalendarCellModel[];
  isLoading: boolean;
  goPrevMonth: () => void;
  goNextMonth: () => void;
  toggleCell: (date: string) => Promise<void>;
}

function addMonthsYm(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`;
}

export function useTaskCalendar(taskId: string | null, today: string): UseTaskCalendarResult {
  const [yearMonth, setYearMonth] = useState<string>(today.slice(0, 7));
  // 月ローカルキャッシュ: key=`${taskId}-${yearMonth}` → Map<date, TaskLog>
  const [cache, setCache] = useState<Map<string, Map<string, TaskLog>>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const task = use$<Task | undefined>(() => {
    if (taskId === null) {
      return undefined;
    }
    return (state$.tasks.get() as Record<string, Task>)[taskId];
  });

  const recentLogs = use$<Record<string, TaskLog>>(() => {
    if (taskId === null) {
      return {};
    }
    const all = Object.values(state$.task_logs.get()) as TaskLog[];
    const map: Record<string, TaskLog> = {};
    for (const lg of all) {
      if (lg.task_id === taskId) {
        map[lg.date] = lg;
      }
    }
    return map;
  });

  const grid = useMemo(() => buildCalendarGrid(yearMonth), [yearMonth]);
  const firstDay = grid[0];
  const lastDay = grid[grid.length - 1];

  // 月切替時の遅延 fetch: 月末が cutoff より古い場合のみ
  useEffect(() => {
    if (taskId === null || task === undefined) {
      return;
    }
    const cutoff = getTaskLogsCutoffDate(today);
    if (lastDay >= cutoff) {
      return; // state$ 経由でカバーされている
    }
    const cacheKey = `${taskId}-${yearMonth}`;
    if (cache.has(cacheKey)) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const rows = await loadTaskLogsInRange(getAppSupabase(), {
          taskId,
          firstDay,
          lastDay,
        });
        if (cancelled) {
          return;
        }
        const byDate = new Map<string, TaskLog>();
        for (const r of rows) {
          byDate.set(r.date, r);
        }
        setCache((prev) => {
          const next = new Map(prev);
          next.set(cacheKey, byDate);
          return next;
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskId, task, yearMonth, firstDay, lastDay, today, cache]);

  const cells: CalendarCellModel[] = useMemo(() => {
    const todayDays = toUtcDays(today);
    const cacheKey = taskId === null ? '' : `${taskId}-${yearMonth}`;
    const cached = cache.get(cacheKey);
    return grid.map((date) => {
      let status: DisplayTaskStatus = 'empty';
      const fromRecent = recentLogs[date];
      if (fromRecent !== undefined) {
        status = fromRecent.status;
      } else if (cached?.has(date)) {
        const lg = cached.get(date);
        if (lg !== undefined) {
          status = lg.status;
        }
      }
      const dueHere =
        task !== undefined &&
        isDueOn(task.frequency as unknown as Frequency, date, task.created_at);
      return {
        date,
        isCurrentMonth: date.slice(0, 7) === yearMonth,
        isDue: dueHere,
        isFuture: toUtcDays(date) > todayDays,
        isToday: date === today,
        status,
      };
    });
  }, [grid, recentLogs, cache, yearMonth, taskId, task, today]);

  const goPrevMonth = useCallback(() => {
    setYearMonth((cur) => addMonthsYm(cur, -1));
  }, []);
  const goNextMonth = useCallback(() => {
    setYearMonth((cur) => addMonthsYm(cur, 1));
  }, []);

  const toggleCell = useCallback(
    async (date: string): Promise<void> => {
      if (taskId === null || task === undefined) {
        return;
      }
      // 未来日禁止
      if (toUtcDays(date) > toUtcDays(today)) {
        return;
      }
      // 頻度外禁止
      if (!isDueOn(task.frequency as unknown as Frequency, date, task.created_at)) {
        return;
      }
      const cur = cells.find((c) => c.date === date);
      if (cur === undefined) {
        return;
      }
      const next = nextCalendarStatus(cur.status);
      if (next === null) {
        clearTaskLogStatus(taskId, date);
        setCache((prev) => {
          const key = `${taskId}-${date.slice(0, 7)}`;
          const m = prev.get(key);
          if (m === undefined) {
            return prev;
          }
          const nm = new Map(m);
          nm.delete(date);
          const np = new Map(prev);
          np.set(key, nm);
          return np;
        });
      } else {
        setTaskLogStatus(taskId, date, next);
        setCache((prev) => {
          const key = `${taskId}-${date.slice(0, 7)}`;
          const m = prev.get(key) ?? new Map<string, TaskLog>();
          const nm = new Map(m);
          const nowIso = new Date().toISOString();
          nm.set(date, {
            task_id: taskId,
            date,
            status: next,
            created_at: nowIso,
            updated_at: nowIso,
          });
          const np = new Map(prev);
          np.set(key, nm);
          return np;
        });
      }
      await refreshTaskStashView();
    },
    [taskId, task, today, cells],
  );

  // taskId 切替時にキャッシュをクリア
  useEffect(() => {
    setCache(new Map());
  }, [taskId]);

  return { yearMonth, cells, isLoading, goPrevMonth, goNextMonth, toggleCell };
}
