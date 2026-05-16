import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login.js';

vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signInWithPassword: vi.fn() } }),
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

const signInMock = vi.fn();
vi.mock('../../lib/auth.js', () => ({
  signIn: (...args: unknown[]): unknown => signInMock(...args),
}));

describe('Login', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signInMock.mockReset();
  });

  it('「ログイン」見出しと submit ボタンが表示される', () => {
    render(<Login />);
    expect(screen.getByRole('heading', { name: 'ログイン' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });

  it('サインアップへのリンクがある', () => {
    render(<Login />);
    expect(screen.getByRole('link', { name: /アカウントをお持ちでない方/ })).toBeInTheDocument();
  });

  it('submit 成功で /today へ navigate される', async () => {
    signInMock.mockResolvedValue({ ok: true, user: { id: 'u1' }, session: { user: { id: 'u1' } } });
    render(<Login />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/today' });
    });
  });

  it('submit 失敗でエラー文が表示される', async () => {
    signInMock.mockResolvedValue({ ok: false, error: 'Invalid login credentials' });
    render(<Login />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid login credentials');
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
