import { state$ } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskNewPage } from './TaskNewPage.js';

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => (
      <a href={props.to}>{props.children}</a>
    ),
    useNavigate: () => navigateMock,
    useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
      select({ location: { pathname: '/tasks/new' } }),
  };
});
vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signOut: vi.fn() } }),
}));
vi.mock('../../lib/auth.js', () => ({
  signOut: vi.fn(),
}));

describe('TaskNewPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    state$.user.set({ id: 'u1', email: 'a@b.co' } as never);
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
    });
  });

  it('「新規タスク」見出しを表示する', () => {
    render(<TaskNewPage />);
    expect(screen.getByRole('heading', { name: '新規タスク' })).toBeInTheDocument();
  });

  it('submit すると state$.tasks に行が追加され /tasks に navigate される', () => {
    render(<TaskNewPage />);
    fireEvent.change(screen.getByLabelText('タスク名'), { target: { value: '新タスク' } });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    const tasks = Object.values(state$.tasks.get());
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.name).toBe('新タスク');
    expect(navigateMock).toHaveBeenCalledWith({ to: '/tasks' });
  });
});
