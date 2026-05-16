import { state$ } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TimeSlotList } from './TimeSlotList.js';

const fakeUser = { id: 'u1', email: 'a@b.co' };

describe('TimeSlotList', () => {
  beforeEach(() => {
    state$.user.set(fakeUser as never);
    state$.tasks.set({});
    state$.time_slots.set({
      s1: {
        id: 's1',
        user_id: 'u1',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      s2: {
        id: 's2',
        user_id: 'u1',
        name: '夜',
        notify_at: '21:00:00',
        sort_order: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('登録済み時間帯を sort_order 順で表示する', () => {
    render(<TimeSlotList />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('朝');
    expect(items[0]).toHaveTextContent('07:00');
    expect(items[1]).toHaveTextContent('夜');
  });

  it('「追加」ボタンでエディタが表示される', () => {
    render(<TimeSlotList />);
    fireEvent.click(screen.getByRole('button', { name: /時間帯を追加/ }));
    expect(screen.getByLabelText('時間帯名')).toBeInTheDocument();
  });

  it('エディタで新規作成すると state$.time_slots に追加される', () => {
    render(<TimeSlotList />);
    fireEvent.click(screen.getByRole('button', { name: /時間帯を追加/ }));
    fireEvent.change(screen.getByLabelText('時間帯名'), { target: { value: '昼' } });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    const slots = Object.values(state$.time_slots.get());
    expect(slots.find((s) => s.name === '昼')).toBeDefined();
  });

  it('削除ボタンで参照タスクなしのスロットを削除できる', () => {
    render(<TimeSlotList />);
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(deleteButtons[0]);
    expect(Object.keys(state$.time_slots.get())).toHaveLength(1);
  });

  it('参照タスクがあるスロットの削除は失敗し alert が表示される', () => {
    state$.tasks.set({
      t1: {
        id: 't1',
        user_id: 'u1',
        time_slot_id: 's1',
        name: '歯磨き',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    render(<TimeSlotList />);
    const deleteButtons = screen.getAllByRole('button', { name: '削除' });
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByRole('alert')).toHaveTextContent(/タスク/);
    expect(state$.time_slots.get().s1).toBeDefined();
  });
});
