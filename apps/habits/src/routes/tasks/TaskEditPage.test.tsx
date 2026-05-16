import { state$, type Task } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskEditPage } from './TaskEditPage.js';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => (
      <a href={props.to}>{props.children}</a>
    ),
    useNavigate: () => navigateMock,
    useParams: () => ({ id: 't1' }),
  };
});

const baseTask: Task = {
  id: 't1',
  user_id: 'u1',
  time_slot_id: 's1',
  name: '元の名前',
  frequency: { type: 'daily' },
  sort_order: 0,
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('TaskEditPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    state$.user.set({ id: 'u1', email: 'a@b.co' } as never);
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
    });
    state$.tasks.set({ t1: baseTask });
  });

  it('既存タスクの値で初期化される', () => {
    render(<TaskEditPage />);
    expect(screen.getByLabelText('タスク名')).toHaveValue('元の名前');
  });

  it('保存ボタンで updateTask が state$ に反映される', () => {
    render(<TaskEditPage />);
    fireEvent.change(screen.getByLabelText('タスク名'), { target: { value: '更新後' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(state$.tasks.get().t1?.name).toBe('更新後');
    expect(navigateMock).toHaveBeenCalledWith({ to: '/tasks' });
  });

  it('アーカイブボタンで archived_at がセットされ navigate される', () => {
    render(<TaskEditPage />);
    fireEvent.click(screen.getByRole('button', { name: 'このタスクをアーカイブ' }));
    expect(state$.tasks.get().t1?.archived_at).not.toBeNull();
    expect(navigateMock).toHaveBeenCalledWith({ to: '/tasks' });
  });

  it('存在しない id は「タスクが見つかりません」を表示', () => {
    state$.tasks.set({});
    render(<TaskEditPage />);
    expect(screen.getByText(/タスクが見つかりません/)).toBeInTheDocument();
  });
});
