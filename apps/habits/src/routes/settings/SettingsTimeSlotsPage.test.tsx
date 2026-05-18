import { state$ } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsTimeSlotsPage } from './SettingsTimeSlotsPage.js';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => (
      <a href={props.to}>{props.children}</a>
    ),
    useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
      select({ location: { pathname: '/settings/time-slots' } }),
    useNavigate: () => vi.fn(),
  };
});
vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signOut: vi.fn() } }),
}));
vi.mock('../../lib/auth.js', () => ({
  signOut: vi.fn(),
}));

describe('SettingsTimeSlotsPage', () => {
  beforeEach(() => {
    state$.user.set({ id: 'u1', email: 'a@b.co' } as never);
    state$.tasks.set({});
    state$.time_slots.set({});
  });

  it('「時間帯設定」見出しを表示する', () => {
    render(<SettingsTimeSlotsPage />);
    expect(screen.getByRole('heading', { name: '時間帯設定' })).toBeInTheDocument();
  });

  it('グローバルナビゲーションが表示される', () => {
    render(<SettingsTimeSlotsPage />);
    // RoutedAppNav により全ナビ項目が表示される
    expect(screen.getByRole('link', { name: '今日' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'タスク' })).toBeInTheDocument();
  });

  it('TimeSlotList の「時間帯を追加」ボタンが見える', () => {
    render(<SettingsTimeSlotsPage />);
    expect(screen.getByRole('button', { name: /時間帯を追加/ })).toBeInTheDocument();
  });

  it('設定リンクが表示される', () => {
    render(<SettingsTimeSlotsPage />);
    const link = screen.getByRole('link', { name: '設定' });
    expect(link).toHaveAttribute('href', '/settings/notifications');
  });
});
