import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.js';
import { router } from './router.js';

// supabase / auth lib を mock。未認証時は session=null、認証済セッションを返す切替が必要なテストもある。
const getCurrentSessionMock = vi.fn();
vi.mock('./lib/auth.js', () => ({
  getCurrentSession: (...args: unknown[]): unknown => getCurrentSessionMock(...args),
  signOut: vi.fn().mockResolvedValue({ ok: true }),
  signIn: vi.fn(),
  signUp: vi.fn(),
  subscribeAuthState: vi.fn().mockReturnValue(() => {}),
}));
vi.mock('./lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({}),
}));
vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    configureSyncPersistence: vi.fn(),
    setupSync: vi.fn(),
    startOnlineWatcher: vi.fn().mockReturnValue(() => {}),
  };
});

async function navigate(path: string): Promise<void> {
  await router.navigate({ to: path });
}

describe('App ルーティング', () => {
  beforeEach(() => {
    getCurrentSessionMock.mockReset();
  });

  it('/auth/login で「ログイン」ページが表示される（未認証）', async () => {
    getCurrentSessionMock.mockResolvedValue(null);
    await navigate('/auth/login');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument();
    });
  });

  it('/auth/signup で「新規登録」ページが表示される（未認証）', async () => {
    getCurrentSessionMock.mockResolvedValue(null);
    await navigate('/auth/signup');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '新規登録' })).toBeInTheDocument();
    });
  });

  it('未認証で /today にアクセスすると /auth/login へリダイレクトされる', async () => {
    getCurrentSessionMock.mockResolvedValue(null);
    await navigate('/today');
    render(<App />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });
  });

  it('認証済みで /today にアクセスすると「今日のタスク」ページが表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/today');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '今日のタスク' })).toBeInTheDocument();
    });
  });

  it('/ から /today（または /auth/login）へリダイレクトされる', async () => {
    getCurrentSessionMock.mockResolvedValue(null);
    await navigate('/');
    render(<App />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });
  });

  it('認証済みで /tasks にアクセスすると「タスク管理」ページが表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/tasks');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'タスク管理' })).toBeInTheDocument();
    });
  });

  it('未認証で /tasks にアクセスすると /auth/login へリダイレクトされる', async () => {
    getCurrentSessionMock.mockResolvedValue(null);
    await navigate('/tasks');
    render(<App />);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });
  });

  it('認証済みで /settings/time-slots にアクセスすると「時間帯の設定」が表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/settings/time-slots');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '時間帯の設定' })).toBeInTheDocument();
    });
  });

  it('認証済みで /stash にアクセスすると「スタッシュ」ページが表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/stash');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'スタッシュ' })).toBeInTheDocument();
    });
  });

  it('認証済みで /history にアクセスすると「履歴」ページが表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/history');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '履歴' })).toBeInTheDocument();
    });
  });

  it('認証済みで /settings/notifications にアクセスすると「通知設定」ページが表示される', async () => {
    getCurrentSessionMock.mockResolvedValue({ user: { id: 'u1' }, access_token: 'x' });
    await navigate('/settings/notifications');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '通知設定' })).toBeInTheDocument();
    });
  });
});
