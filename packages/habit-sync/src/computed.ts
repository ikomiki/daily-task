import { type Frequency, isDueOn } from '@org/habit-core';
import type { Task, TaskLog, TaskStatus, TimeSlot } from './types.js';

export type DisplayTaskStatus = TaskStatus | 'empty';

export interface TodayTaskItem {
  id: string;
  name: string;
  status: DisplayTaskStatus;
  sort_order: number;
}

export interface TodayTaskGroup {
  time_slot_id: string;
  slot_name: string;
  notify_at: string;
  slot_sort_order: number;
  tasks: TodayTaskItem[];
}

// §6.3 の 4-step を純粋関数化:
// 1) archived_at IS NULL でフィルタ
// 2) isDueOn(frequency, today, created_at) でフィルタ
// 3) task_logs の (task_id, today) で status を突合（無ければ 'empty'）
// 4) time_slot_id でグループ化、各グループ内 sort_order 昇順、グループ間 slot.sort_order 昇順
export function getTodayTasksView(
  tasks: Task[],
  taskLogs: TaskLog[],
  timeSlots: TimeSlot[],
  today: string,
): TodayTaskGroup[] {
  // step 1 + 2: フィルタ
  const activeTasks = tasks.filter((t) => {
    if (t.archived_at !== null) {
      return false;
    }
    // frequency は db では Json 型、ここで Frequency 判別共用体として解釈する
    return isDueOn(t.frequency as unknown as Frequency, today, t.created_at);
  });

  // step 3: log を (task_id, today) で索引化
  const logByTask = new Map<string, TaskLog>();
  for (const lg of taskLogs) {
    if (lg.date === today) {
      logByTask.set(lg.task_id, lg);
    }
  }

  // step 4: time_slot ごとにグループ化
  const slotById = new Map<string, TimeSlot>();
  for (const s of timeSlots) {
    slotById.set(s.id, s);
  }

  const tasksBySlot = new Map<string, Task[]>();
  for (const t of activeTasks) {
    const arr = tasksBySlot.get(t.time_slot_id);
    if (arr === undefined) {
      tasksBySlot.set(t.time_slot_id, [t]);
    } else {
      arr.push(t);
    }
  }

  const groups: TodayTaskGroup[] = [];
  for (const [slotId, slotTasks] of tasksBySlot.entries()) {
    const slot = slotById.get(slotId);
    if (slot === undefined) {
      // 整合性エラー: slot が見つからない場合は除外
      continue;
    }
    const items: TodayTaskItem[] = slotTasks
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t) => ({
        id: t.id,
        name: t.name,
        status: logByTask.get(t.id)?.status ?? 'empty',
        sort_order: t.sort_order,
      }));
    groups.push({
      time_slot_id: slotId,
      slot_name: slot.name,
      notify_at: slot.notify_at,
      slot_sort_order: slot.sort_order,
      tasks: items,
    });
  }

  return groups.sort((a, b) => a.slot_sort_order - b.slot_sort_order);
}
