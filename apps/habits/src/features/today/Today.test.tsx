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
    useNavigate: (): typeof navigateMock => navigateMock,
  };
});

const signOutMock = vi.fn();
vi.mock('../../lib/auth.js', () => ({
  signOut: (...args: unknown[]): unknown => signOutMock(...args),
}));

describe('Today', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signOutMock.mockReset();
  });

  it('「今日のタスク」見出しを表示する', () => {
    render(<Today />);
    expect(screen.getByRole('heading', { name: '今日のタスク' })).toBeInTheDocument();
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
});
