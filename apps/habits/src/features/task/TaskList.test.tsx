import { state$, type Task, type TimeSlot } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskList } from './TaskList.js';

function task(t: Partial<Task> & Pick<Task, 'id' | 'name' | 'time_slot_id'>): Task {
  return {
    user_id: 'u1',
    frequency: { type: 'daily' },
    sort_order: 0,
    archived_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...t,
  };
}

function slot(s: Partial<TimeSlot> & Pick<TimeSlot, 'id' | 'name'>): TimeSlot {
  return {
    user_id: 'u1',
    notify_at: '07:00:00',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...s,
  };
}

describe('TaskList', () => {
  beforeEach(() => {
    state$.tasks.set({});
    state$.time_slots.set({});
  });

  it('タスクが 0 件のときは Empty を表示', () => {
    render(<TaskList onEdit={vi.fn()} />);
    expect(screen.getByText(/タスクが登録されていません/)).toBeInTheDocument();
  });

  it('アクティブなタスクを表示する', () => {
    state$.time_slots.set({ s1: slot({ id: 's1', name: '朝' }) });
    state$.tasks.set({ t1: task({ id: 't1', name: '歯磨き', time_slot_id: 's1' }) });
    render(<TaskList onEdit={vi.fn()} />);
    expect(screen.getByText('歯磨き')).toBeInTheDocument();
  });

  it('アーカイブ済タスクは初期表示では非表示', () => {
    state$.time_slots.set({ s1: slot({ id: 's1', name: '朝' }) });
    state$.tasks.set({
      t1: task({
        id: 't1',
        name: 'アーカイブ済',
        time_slot_id: 's1',
        archived_at: '2026-01-01T00:00:00Z',
      }),
    });
    render(<TaskList onEdit={vi.fn()} />);
    expect(screen.queryByText('アーカイブ済')).not.toBeInTheDocument();
  });

  it('「アーカイブ済を表示」をクリックすると非アクティブセクションが見える', () => {
    state$.time_slots.set({ s1: slot({ id: 's1', name: '朝' }) });
    state$.tasks.set({
      t1: task({
        id: 't1',
        name: 'アーカイブ済',
        time_slot_id: 's1',
        archived_at: '2026-01-01T00:00:00Z',
      }),
    });
    render(<TaskList onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /アーカイブ済を表示/ }));
    expect(screen.getByText('アーカイブ済')).toBeInTheDocument();
  });

  it('onEdit がカードの「編集」クリックで呼ばれる', () => {
    state$.time_slots.set({ s1: slot({ id: 's1', name: '朝' }) });
    state$.tasks.set({ t1: task({ id: 't1', name: '歯磨き', time_slot_id: 's1' }) });
    const onEdit = vi.fn();
    render(<TaskList onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    expect(onEdit).toHaveBeenCalledWith('t1');
  });
});
