import { use$ } from '@legendapp/state/react';
import { state$, type Task, type TaskStashView, type TimeSlot } from '@org/habit-sync';

export interface TaskStashRow {
  task_id: string;
  task_name: string;
  slot_name: string;
  complete_count: number | null;
  fail_count: number | null;
  skip_count: number | null;
  current_streak: number | null;
  task_days: number | null;
  completion_rate: number | null;
  last_completed_date: string | null;
}

// アーカイブされていないタスクのみを対象に、task_stash_view との JOIN 相当を行い、
// 時間帯 sort_order → タスク sort_order でソートして返す。
// stash_view に行が無いタスクは全カラム null の行として返す（新規追加直後の状態）。
export function useTaskStashList(): TaskStashRow[] {
  return use$(() => {
    const tasks = Object.values(state$.tasks.get()) as Task[];
    const slots = Object.values(state$.time_slots.get()) as TimeSlot[];
    const stashes = state$.task_stash_view.get() as Record<string, TaskStashView>;

    const slotById = new Map<string, TimeSlot>();
    for (const s of slots) {
      slotById.set(s.id, s);
    }

    // アクティブ + slot 解決可能なタスクを「task + slot」ペアに変換
    interface Pair {
      task: Task;
      slot: TimeSlot;
    }
    const pairs: Pair[] = [];
    for (const t of tasks) {
      if (t.archived_at !== null) {
        continue;
      }
      const slot = slotById.get(t.time_slot_id);
      if (slot === undefined) {
        continue;
      }
      pairs.push({ task: t, slot });
    }

    // スロット sort_order → タスク sort_order でソート
    pairs.sort((a, b) => {
      if (a.slot.sort_order !== b.slot.sort_order) {
        return a.slot.sort_order - b.slot.sort_order;
      }
      return a.task.sort_order - b.task.sort_order;
    });

    return pairs.map(({ task: t, slot }) => {
      const stash = stashes[t.id];
      return {
        task_id: t.id,
        task_name: t.name,
        slot_name: slot.name,
        complete_count: stash?.complete_count ?? null,
        fail_count: stash?.fail_count ?? null,
        skip_count: stash?.skip_count ?? null,
        current_streak: stash?.current_streak ?? null,
        task_days: stash?.task_days ?? null,
        completion_rate: stash?.completion_rate ?? null,
        last_completed_date: stash?.last_completed_date ?? null,
      };
    });
  });
}
