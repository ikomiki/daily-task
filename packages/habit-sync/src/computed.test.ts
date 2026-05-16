import type { Frequency } from '@org/habit-core';
import { describe, expect, it } from 'vitest';
import { getTodayTasksView } from './computed.js';
import type { Task, TaskLog, TimeSlot } from './types.js';

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'time_slot_id' | 'name'>): Task {
  return {
    user_id: 'u1',
    frequency: { type: 'daily' } satisfies Frequency,
    sort_order: 0,
    archived_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function slot(
  overrides: Partial<TimeSlot> & Pick<TimeSlot, 'id' | 'name' | 'sort_order'>,
): TimeSlot {
  return {
    user_id: 'u1',
    notify_at: '07:00:00',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function log(task_id: string, date: string, status: 'complete' | 'skip' | 'fail'): TaskLog {
  return {
    task_id,
    date,
    status,
    created_at: '2026-05-16T00:00:00Z',
    updated_at: '2026-05-16T00:00:00Z',
  };
}

describe('getTodayTasksView', () => {
  it('空配列の場合は空配列を返す', () => {
    expect(getTodayTasksView([], [], [], '2026-05-16')).toEqual([]);
  });

  it('archived_at が非 null のタスクは除外される', () => {
    const tasks: Task[] = [
      task({ id: 't1', time_slot_id: 's1', name: 'A' }),
      task({ id: 't2', time_slot_id: 's1', name: 'B', archived_at: '2026-05-15T00:00:00Z' }),
    ];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0 })];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view).toHaveLength(1);
    expect(view[0].tasks).toHaveLength(1);
    expect(view[0].tasks[0].name).toBe('A');
  });

  it('isDueOn が false のタスクは除外される（every_n_days で当日が周期外）', () => {
    const tasks: Task[] = [
      task({
        id: 't1',
        time_slot_id: 's1',
        name: '3日に1回',
        frequency: { type: 'every_n_days', n: 3, anchor: '2026-05-01' } satisfies Frequency,
        created_at: '2026-05-01',
      }),
    ];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '夜', sort_order: 0 })];
    // 2026-05-02 は anchor + 1 で周期外
    expect(getTodayTasksView(tasks, [], slots, '2026-05-02')).toEqual([]);
    // 2026-05-04 は anchor + 3 で周期内
    expect(getTodayTasksView(tasks, [], slots, '2026-05-04')[0].tasks).toHaveLength(1);
  });

  it('today の log があれば status が反映される', () => {
    const tasks: Task[] = [task({ id: 't1', time_slot_id: 's1', name: 'A' })];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0 })];
    const logs: TaskLog[] = [log('t1', '2026-05-16', 'complete')];
    const view = getTodayTasksView(tasks, logs, slots, '2026-05-16');
    expect(view[0].tasks[0].status).toBe('complete');
  });

  it('today の log がなければ status は empty', () => {
    const tasks: Task[] = [task({ id: 't1', time_slot_id: 's1', name: 'A' })];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0 })];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view[0].tasks[0].status).toBe('empty');
  });

  it('他の日付の log は今日の status に影響しない', () => {
    const tasks: Task[] = [task({ id: 't1', time_slot_id: 's1', name: 'A' })];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0 })];
    const logs: TaskLog[] = [log('t1', '2026-05-15', 'complete')];
    const view = getTodayTasksView(tasks, logs, slots, '2026-05-16');
    expect(view[0].tasks[0].status).toBe('empty');
  });

  it('time_slot_id でグループ化される', () => {
    const tasks: Task[] = [
      task({ id: 't1', time_slot_id: 's1', name: '朝A', sort_order: 0 }),
      task({ id: 't2', time_slot_id: 's1', name: '朝B', sort_order: 1 }),
      task({ id: 't3', time_slot_id: 's2', name: '夜A', sort_order: 0 }),
    ];
    const slots: TimeSlot[] = [
      slot({ id: 's1', name: '朝', sort_order: 0 }),
      slot({ id: 's2', name: '夜', sort_order: 1 }),
    ];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view).toHaveLength(2);
    expect(view[0].time_slot_id).toBe('s1');
    expect(view[0].tasks.map((t) => t.name)).toEqual(['朝A', '朝B']);
    expect(view[1].time_slot_id).toBe('s2');
    expect(view[1].tasks.map((t) => t.name)).toEqual(['夜A']);
  });

  it('各グループ内は sort_order 昇順', () => {
    const tasks: Task[] = [
      task({ id: 't1', time_slot_id: 's1', name: 'C', sort_order: 2 }),
      task({ id: 't2', time_slot_id: 's1', name: 'A', sort_order: 0 }),
      task({ id: 't3', time_slot_id: 's1', name: 'B', sort_order: 1 }),
    ];
    const slots: TimeSlot[] = [slot({ id: 's1', name: '朝', sort_order: 0 })];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view[0].tasks.map((t) => t.name)).toEqual(['A', 'B', 'C']);
  });

  it('グループ間も time_slot.sort_order 昇順', () => {
    const tasks: Task[] = [
      task({ id: 't1', time_slot_id: 's2', name: '夜', sort_order: 0 }),
      task({ id: 't2', time_slot_id: 's1', name: '朝', sort_order: 0 }),
    ];
    const slots: TimeSlot[] = [
      slot({ id: 's1', name: '朝', sort_order: 0 }),
      slot({ id: 's2', name: '夜', sort_order: 1 }),
    ];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view.map((g) => g.slot_name)).toEqual(['朝', '夜']);
  });

  it('タスクが存在しない time_slot はグループから除外される', () => {
    const tasks: Task[] = [task({ id: 't1', time_slot_id: 's1', name: '朝' })];
    const slots: TimeSlot[] = [
      slot({ id: 's1', name: '朝', sort_order: 0 }),
      slot({ id: 's2', name: '夜', sort_order: 1 }),
    ];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view).toHaveLength(1);
    expect(view[0].slot_name).toBe('朝');
  });

  it('group 内の各タスクは notify_at と slot 名を持つ（UI 表示用）', () => {
    const tasks: Task[] = [task({ id: 't1', time_slot_id: 's1', name: 'A' })];
    const slots: TimeSlot[] = [
      slot({ id: 's1', name: '朝', sort_order: 0, notify_at: '07:30:00' }),
    ];
    const view = getTodayTasksView(tasks, [], slots, '2026-05-16');
    expect(view[0].slot_name).toBe('朝');
    expect(view[0].notify_at).toBe('07:30:00');
  });
});
