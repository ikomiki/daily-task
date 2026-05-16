import type { TodayTaskGroup } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TimeSlotGroup } from './TimeSlotGroup.js';

const today = '2026-05-16';
const baseGroup: TodayTaskGroup = {
  time_slot_id: 's1',
  slot_name: '朝',
  notify_at: '07:00:00',
  slot_sort_order: 0,
  tasks: [
    { id: 't1', name: '歯磨き', status: 'empty', sort_order: 0 },
    { id: 't2', name: 'メール確認', status: 'complete', sort_order: 1 },
  ],
};

describe('TimeSlotGroup', () => {
  it('スロット名を見出しとして表示する', () => {
    render(<TimeSlotGroup group={baseGroup} today={today} />);
    expect(screen.getByRole('heading', { name: /朝/ })).toBeInTheDocument();
  });

  it('notify_at を HH:MM 形式で表示する（秒は省く）', () => {
    render(<TimeSlotGroup group={baseGroup} today={today} />);
    expect(screen.getByText('07:00')).toBeInTheDocument();
  });

  it('group.tasks の各タスクを表示する', () => {
    render(<TimeSlotGroup group={baseGroup} today={today} />);
    expect(screen.getByText('歯磨き')).toBeInTheDocument();
    expect(screen.getByText('メール確認')).toBeInTheDocument();
  });

  it('tasks が空の場合は「タスクなし」を表示する', () => {
    render(<TimeSlotGroup group={{ ...baseGroup, tasks: [] }} today={today} />);
    expect(screen.getByText(/タスクなし/)).toBeInTheDocument();
  });
});
