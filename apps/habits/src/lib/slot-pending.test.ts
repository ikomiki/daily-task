import type { Task, TaskLog, TimeSlot } from '@org/habit-sync';
import { describe, expect, it } from 'vitest';
import { getSlotPendingNotificationTasks } from './slot-pending.js';

const NOW = '2026-05-16T00:00:00Z';

function mkTask(over: Partial<Task> & { id: string }): Task {
  return {
    id: over.id,
    user_id: 'u',
    time_slot_id: 's1',
    name: over.name ?? `task-${over.id}`,
    frequency: { type: 'daily' },
    sort_order: 0,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}
function mkSlot(over: Partial<TimeSlot> & { id: string }): TimeSlot {
  return {
    id: over.id,
    user_id: 'u',
    name: over.name ?? 'slot',
    notify_at: '09:00:00',
    sort_order: 0,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}
function mkLog(taskId: string, date: string, status: 'complete' | 'skip' | 'fail'): TaskLog {
  return { task_id: taskId, date, status, created_at: NOW, updated_at: NOW };
}

describe('getSlotPendingNotificationTasks', () => {
  it('スロットが存在しない場合は空配列', () => {
    expect(getSlotPendingNotificationTasks('missing', '2026-05-16', [], [], [])).toEqual([]);
  });

  it('指定スロットの未操作タスクだけを返す', () => {
    const slots = [mkSlot({ id: 's1' })];
    const tasks = [
      mkTask({ id: 't1', time_slot_id: 's1', name: 'A' }),
      mkTask({ id: 't2', time_slot_id: 's1', name: 'B' }),
    ];
    const result = getSlotPendingNotificationTasks('s1', '2026-05-16', tasks, [], slots);
    expect(result.map((t) => t.name).sort()).toEqual(['A', 'B']);
  });

  it('既に complete/skip/fail のタスクは除外', () => {
    const slots = [mkSlot({ id: 's1' })];
    const tasks = [
      mkTask({ id: 't1', time_slot_id: 's1', name: 'A' }),
      mkTask({ id: 't2', time_slot_id: 's1', name: 'B' }),
      mkTask({ id: 't3', time_slot_id: 's1', name: 'C' }),
    ];
    const logs = [mkLog('t1', '2026-05-16', 'complete'), mkLog('t2', '2026-05-16', 'skip')];
    const result = getSlotPendingNotificationTasks('s1', '2026-05-16', tasks, logs, slots);
    expect(result.map((t) => t.name)).toEqual(['C']);
  });

  it('他スロットのタスクは含まない', () => {
    const slots = [mkSlot({ id: 's1' }), mkSlot({ id: 's2' })];
    const tasks = [
      mkTask({ id: 't1', time_slot_id: 's1', name: 'A' }),
      mkTask({ id: 't2', time_slot_id: 's2', name: 'B' }),
    ];
    const result = getSlotPendingNotificationTasks('s1', '2026-05-16', tasks, [], slots);
    expect(result.map((t) => t.name)).toEqual(['A']);
  });

  it('archived タスクは除外', () => {
    const slots = [mkSlot({ id: 's1' })];
    const tasks = [
      mkTask({ id: 't1', time_slot_id: 's1', name: 'A' }),
      mkTask({ id: 't2', time_slot_id: 's1', name: 'B', archived_at: '2026-05-15T00:00:00Z' }),
    ];
    const result = getSlotPendingNotificationTasks('s1', '2026-05-16', tasks, [], slots);
    expect(result.map((t) => t.name)).toEqual(['A']);
  });

  it('頻度に合わない (every_n_days=2, anchor 違い) タスクは除外', () => {
    const slots = [mkSlot({ id: 's1' })];
    const tasks = [
      mkTask({
        id: 't1',
        time_slot_id: 's1',
        name: 'A',
        frequency: { type: 'every_n_days', n: 2, anchor: '2026-05-15' },
      }),
    ];
    // anchor=2026-05-15 + every 2 days → 5/15, 5/17 がマッチ。5/16 はマッチしない
    const result = getSlotPendingNotificationTasks('s1', '2026-05-16', tasks, [], slots);
    expect(result).toEqual([]);
  });
});
