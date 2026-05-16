import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Signup } from './Signup.js';

vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({ auth: { signUp: vi.fn() } }),
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

const signUpMock = vi.fn();
vi.mock('../../lib/auth.js', () => ({
  signUp: (...args: unknown[]): unknown => signUpMock(...args),
}));

describe('Signup', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signUpMock.mockReset();
  });

  it('「新規登録」見出しと submit ボタンが表示される', () => {
    render(<Signup />);
    expect(screen.getByRole('heading', { name: '新規登録' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新規登録' })).toBeInTheDocument();
  });

  it('ログインへのリンクがある', () => {
    render(<Signup />);
    expect(screen.getByRole('link', { name: /既にアカウントをお持ちの方/ })).toBeInTheDocument();
  });

  it('submit 成功で /today へ navigate される', async () => {
    signUpMock.mockResolvedValue({ ok: true, user: { id: 'u1' }, session: { user: { id: 'u1' } } });
    render(<Signup />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '新規登録' }));
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/today' });
    });
  });

  it('submit 失敗でエラー文が表示される', async () => {
    signUpMock.mockResolvedValue({ ok: false, error: 'User already registered' });
    render(<Signup />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'dup@example.com' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '新規登録' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('User already registered');
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
