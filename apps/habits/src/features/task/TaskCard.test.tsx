import type { Task, TimeSlot } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskCard } from './TaskCard.js';

const baseTask: Task = {
  id: 't1',
  user_id: 'u1',
  time_slot_id: 's1',
  name: '歯磨き',
  frequency: { type: 'daily' },
  sort_order: 0,
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const slot: TimeSlot = {
  id: 's1',
  user_id: 'u1',
  name: '朝',
  notify_at: '07:00:00',
  sort_order: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('TaskCard', () => {
  it('タスク名と頻度サマリと時間帯名を表示する', () => {
    render(
      <TaskCard
        task={baseTask}
        timeSlotName={slot.name}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />,
    );
    expect(screen.getByText('歯磨き')).toBeInTheDocument();
    expect(screen.getByText('毎日', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('朝', { exact: false })).toBeInTheDocument();
  });

  it('archived=null では「編集」と「アーカイブ」ボタンを表示する', () => {
    render(
      <TaskCard
        task={baseTask}
        timeSlotName={slot.name}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'アーカイブ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '復元' })).not.toBeInTheDocument();
  });

  it('archived の場合は「復元」のみ表示', () => {
    const archived = { ...baseTask, archived_at: '2026-05-01T00:00:00Z' };
    render(
      <TaskCard
        task={archived}
        timeSlotName={slot.name}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '復元' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'アーカイブ' })).not.toBeInTheDocument();
  });

  it('「編集」クリックで onEdit が呼ばれる', () => {
    const onEdit = vi.fn();
    render(
      <TaskCard
        task={baseTask}
        timeSlotName={slot.name}
        onEdit={onEdit}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    expect(onEdit).toHaveBeenCalledWith('t1');
  });

  it('「アーカイブ」クリックで onArchive が呼ばれる', () => {
    const onArchive = vi.fn();
    render(
      <TaskCard
        task={baseTask}
        timeSlotName={slot.name}
        onEdit={vi.fn()}
        onArchive={onArchive}
        onUnarchive={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'アーカイブ' }));
    expect(onArchive).toHaveBeenCalledWith('t1');
  });

  it('「復元」クリックで onUnarchive が呼ばれる', () => {
    const onUnarchive = vi.fn();
    const archived = { ...baseTask, archived_at: '2026-05-01T00:00:00Z' };
    render(
      <TaskCard
        task={archived}
        timeSlotName={slot.name}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        onUnarchive={onUnarchive}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '復元' }));
    expect(onUnarchive).toHaveBeenCalledWith('t1');
  });
});
