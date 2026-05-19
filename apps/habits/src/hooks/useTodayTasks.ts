import { useValue } from '@legendapp/state/react';
import { getTodayTasksView, state$, type TodayTaskGroup } from '@org/habit-sync';

// 今日のタスクビューを返す React フック。
// state$ の tasks / task_logs / time_slots を購読し、変更時に再評価される。
// today は呼び出し側が決定（タイムゾーンに依存するため）。
export function useTodayTasks(today: string): TodayTaskGroup[] {
  return useValue(() => {
    const tasks = Object.values(state$.tasks.get());
    const taskLogs = Object.values(state$.task_logs.get());
    const timeSlots = Object.values(state$.time_slots.get());
    return getTodayTasksView(tasks, taskLogs, timeSlots, today);
  });
}
