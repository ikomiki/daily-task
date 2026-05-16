import type { Frequency } from '@org/habit-core';
import type { TimeSlot } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskForm } from './TaskForm.js';

const slots: TimeSlot[] = [
  {
    id: 's1',
    user_id: 'u1',
    name: '朝',
    notify_at: '07:00:00',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 's2',
    user_id: 'u1',
    name: '夜',
    notify_at: '21:00:00',
    sort_order: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

describe('TaskForm', () => {
  it('name の入力欄を表示する', () => {
    render(<TaskForm timeSlots={slots} onSubmit={vi.fn()} submitLabel="保存" />);
    expect(screen.getByLabelText('タスク名')).toBeInTheDocument();
  });

  it('time_slot の select に渡された slots が並ぶ', () => {
    render(<TaskForm timeSlots={slots} onSubmit={vi.fn()} submitLabel="保存" />);
    expect(screen.getByRole('option', { name: '朝' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '夜' })).toBeInTheDocument();
  });

  it('initial を渡すとフィールドが初期化される', () => {
    const initial = {
      name: '歯磨き',
      time_slot_id: 's2',
      frequency: { type: 'daily' } satisfies Frequency,
    };
    render(<TaskForm timeSlots={slots} initial={initial} onSubmit={vi.fn()} submitLabel="保存" />);
    expect(screen.getByLabelText('タスク名')).toHaveValue('歯磨き');
    expect(screen.getByLabelText('時間帯')).toHaveValue('s2');
  });

  it('submit で onSubmit が現在値を受け取る', () => {
    const onSubmit = vi.fn();
    render(<TaskForm timeSlots={slots} onSubmit={onSubmit} submitLabel="作成" />);
    fireEvent.change(screen.getByLabelText('タスク名'), { target: { value: '新タスク' } });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '新タスク',
        time_slot_id: 's1',
        frequency: { type: 'daily' },
      }),
    );
  });

  it('name が空のときは onSubmit を呼ばずエラーを表示する', () => {
    const onSubmit = vi.fn();
    render(<TaskForm timeSlots={slots} onSubmit={onSubmit} submitLabel="作成" />);
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/タスク名/);
  });

  it('time_slots が空のとき警告を表示し submit を無効化する', () => {
    render(<TaskForm timeSlots={[]} onSubmit={vi.fn()} submitLabel="作成" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/時間帯/);
    expect(screen.getByRole('button', { name: '作成' })).toBeDisabled();
  });
});
