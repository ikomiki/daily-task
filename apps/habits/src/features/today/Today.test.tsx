import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Today } from './Today.js';

vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signOut: vi.fn() } }),
}));

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: { to: string; children: React.ReactNode }) => (
      <a href={props.to}>{props.children}</a>
    ),
    useNavigate: (): typeof navigateMock => navigateMock,
  };
});

const signOutMock = vi.fn();
vi.mock('../../lib/auth.js', () => ({
  signOut: (...args: unknown[]): unknown => signOutMock(...args),
}));

// TodayView は別途テスト済み。Today のテストでは「呼ばれる」ことのみ確認
const todayViewMock = vi.fn();
vi.mock('./TodayView.js', () => ({
  TodayView: (props: { today: string }) => {
    todayViewMock(props);
    return <div data-testid="today-view">today={props.today}</div>;
  },
}));

describe('Today', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signOutMock.mockReset();
    todayViewMock.mockReset();
  });

  it('「今日のタスク」見出しを表示する', () => {
    render(<Today />);
    expect(screen.getByRole('heading', { name: '今日のタスク' })).toBeInTheDocument();
  });

  it('TodayView に today (YYYY-MM-DD) を渡す', () => {
    render(<Today />);
    expect(todayViewMock).toHaveBeenCalledTimes(1);
    const props = todayViewMock.mock.calls[0][0];
    expect(props.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ログアウトボタンクリックで signOut → /auth/login へ navigate', async () => {
    signOutMock.mockResolvedValue({ ok: true });
    render(<Today />);
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith({ to: '/auth/login' });
    });
  });

  it('タスク管理リンクが表示される', () => {
    render(<Today />);
    expect(screen.getByRole('link', { name: 'タスク管理' })).toBeInTheDocument();
  });

  it('スタッシュリンクが表示される', () => {
    render(<Today />);
    expect(screen.getByRole('link', { name: 'スタッシュ' })).toBeInTheDocument();
  });

  it('設定リンクが表示される', () => {
    render(<Today />);
    expect(screen.getByRole('link', { name: '設定' })).toBeInTheDocument();
  });

  it('履歴リンクが表示される', () => {
    render(<Today />);
    expect(screen.getByRole('link', { name: '履歴' })).toBeInTheDocument();
  });
});
