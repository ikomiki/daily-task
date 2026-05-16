import { state$, type Task, type TaskLog, type TimeSlot } from '@org/habit-sync';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTodayTasks } from './useTodayTasks.js';

function task(t: Partial<Task> & Pick<Task, 'id' | 'time_slot_id' | 'name'>): Task {
  return {
    user_id: 'u1',
    frequency: { type: 'daily' },
    sort_order: 0,
    archived_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01T00:00:00Z',
    ...t,
  };
}

function slot(s: Partial<TimeSlot> & Pick<TimeSlot, 'id' | 'name' | 'sort_order'>): TimeSlot {
  return {
    user_id: 'u1',
    notify_at: '07:00:00',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...s,
  };
}

describe('useTodayTasks', () => {
  beforeEach(() => {
    state$.tasks.set({});
    state$.task_logs.set({});
    state$.time_slots.set({});
  });

  it('state が空のときは空配列を返す', () => {
    const { result } = renderHook(() => useTodayTasks('2026-05-16'));
    expect(result.current).toEqual([]);
  });

  it('state にタスクと slot を設定すると today のビューを返す', () => {
    state$.tasks.set({
      t1: task({ id: 't1', time_slot_id: 's1', name: '歯磨き' }),
    });
    state$.time_slots.set({
      s1: slot({ id: 's1', name: '朝', sort_order: 0 }),
    });
    const { result } = renderHook(() => useTodayTasks('2026-05-16'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].slot_name).toBe('朝');
    expect(result.current[0].tasks).toHaveLength(1);
    expect(result.current[0].tasks[0].name).toBe('歯磨き');
    expect(result.current[0].tasks[0].status).toBe('empty');
  });

  it('today の log が status に反映される', () => {
    state$.tasks.set({
      t1: task({ id: 't1', time_slot_id: 's1', name: '歯磨き' }),
    });
    state$.time_slots.set({
      s1: slot({ id: 's1', name: '朝', sort_order: 0 }),
    });
    state$.task_logs.set({
      't1-2026-05-16': {
        task_id: 't1',
        date: '2026-05-16',
        status: 'complete',
        created_at: '2026-05-16T00:00:00Z',
        updated_at: '2026-05-16T00:00:00Z',
      } satisfies TaskLog,
    });
    const { result } = renderHook(() => useTodayTasks('2026-05-16'));
    expect(result.current[0].tasks[0].status).toBe('complete');
  });
});
