import { state$, type Task, type TimeSlot } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodayView } from './TodayView.js';

const today = '2026-05-16';

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

describe('TodayView', () => {
  beforeEach(() => {
    state$.tasks.set({});
    state$.task_logs.set({});
    state$.time_slots.set({});
  });

  it('タスクが 0 件の場合は Empty 状態を表示する', () => {
    render(<TodayView today={today} />);
    expect(screen.getByText(/今日のタスクはありません/)).toBeInTheDocument();
  });

  it('タスクが 1 件あればそのタスク名が表示される', () => {
    state$.tasks.set({
      t1: task({ id: 't1', time_slot_id: 's1', name: '歯磨き' }),
    });
    state$.time_slots.set({
      s1: slot({ id: 's1', name: '朝', sort_order: 0 }),
    });
    render(<TodayView today={today} />);
    expect(screen.getByText('歯磨き')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /朝/ })).toBeInTheDocument();
  });

  it('複数スロットがあれば slot_sort_order 順に表示される', () => {
    state$.tasks.set({
      t1: task({ id: 't1', time_slot_id: 's2', name: '夜タスク' }),
      t2: task({ id: 't2', time_slot_id: 's1', name: '朝タスク' }),
    });
    state$.time_slots.set({
      s1: slot({ id: 's1', name: '朝', sort_order: 0 }),
      s2: slot({ id: 's2', name: '夜', sort_order: 1 }),
    });
    render(<TodayView today={today} />);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]).toHaveTextContent('朝');
    expect(headings[1]).toHaveTextContent('夜');
  });
});
