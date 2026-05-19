import { state$ } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TasksPage } from './TasksPage.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => (
      <a href={props.to}>{props.children}</a>
    ),
    useNavigate: () => vi.fn(),
    useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
      select({ location: { pathname: '/tasks' } }),
  };
});
vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signOut: vi.fn() } }),
}));
vi.mock('../../lib/auth.js', () => ({
  signOut: vi.fn(),
}));

describe('TasksPage', () => {
  beforeEach(() => {
    state$.tasks.set({});
    state$.time_slots.set({});
  });

  it('「タスク管理」見出しと「新規追加」ボタンを表示する', () => {
    render(<TasksPage />);
    expect(screen.getByRole('heading', { name: 'タスク管理' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '新規追加' })).toBeInTheDocument();
  });

  it('「今日」へのナビリンクがある', () => {
    render(<TasksPage />);
    expect(screen.getByRole('link', { name: '今日' })).toBeInTheDocument();
  });
});
