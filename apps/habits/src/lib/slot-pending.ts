import { getTodayTasksView, type Task, type TaskLog, type TimeSlot } from '@org/habit-sync';

// 指定スロットで「今日」発火すべき未操作タスクを抽出する。
// 既存の getTodayTasksView を再利用して、time_slot_id 一致 + status='empty' で絞る。
// archived や頻度マッチ判定は getTodayTasksView が内部で実施済み。
export function getSlotPendingNotificationTasks(
  slotId: string,
  today: string,
  tasks: Task[],
  taskLogs: TaskLog[],
  timeSlots: TimeSlot[],
): Task[] {
  const groups = getTodayTasksView(tasks, taskLogs, timeSlots, today);
  const group = groups.find((g) => g.time_slot_id === slotId);
  if (group === undefined) {
    return [];
  }
  // getTodayTasksView の戻り値 TodayTaskItem には Task 全体は含まれないので、
  // 元の tasks 配列から id で引き直す（archived/frequency フィルタは通過済み）
  const taskById = new Map(tasks.map((t) => [t.id, t] as const));
  const pendingItems = group.tasks.filter((it) => it.status === 'empty');
  const result: Task[] = [];
  for (const it of pendingItems) {
    const task = taskById.get(it.id);
    if (task !== undefined) {
      result.push(task);
    }
  }
  return result;
}
