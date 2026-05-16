import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthForm } from './AuthForm.js';

describe('AuthForm', () => {
  it('submit ボタンに渡された label を表示する', () => {
    render(<AuthForm submitLabel="ログイン" onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
  });

  it('email と password を入力して submit すると onSubmit が呼ばれる', () => {
    const onSubmit = vi.fn();
    render(<AuthForm submitLabel="登録" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co', password: 'password123' });
  });

  it('email が空のときは onSubmit を呼ばずバリデーションエラーを表示する', () => {
    const onSubmit = vi.fn();
    render(<AuthForm submitLabel="登録" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/メールアドレス/);
  });

  it('email 形式が不正なときは onSubmit を呼ばずエラーを表示する', () => {
    const onSubmit = vi.fn();
    render(<AuthForm submitLabel="登録" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/メールアドレス/);
  });

  it('password が 6 文字未満のときは onSubmit を呼ばずエラーを表示する', () => {
    const onSubmit = vi.fn();
    render(<AuthForm submitLabel="登録" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('メールアドレス'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/パスワード/);
  });

  it('外部から渡された errorMessage を表示する', () => {
    render(<AuthForm submitLabel="登録" onSubmit={vi.fn()} errorMessage="サーバーエラー" />);
    expect(screen.getByRole('alert')).toHaveTextContent('サーバーエラー');
  });

  it('isSubmitting=true の間はボタンが disabled になる', () => {
    render(<AuthForm submitLabel="登録" onSubmit={vi.fn()} isSubmitting={true} />);
    expect(screen.getByRole('button', { name: '登録' })).toBeDisabled();
  });

  it('passwordAutoComplete prop で autoComplete を切り替えられる', () => {
    const { rerender } = render(<AuthForm submitLabel="ログイン" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('パスワード')).toHaveAttribute('autocomplete', 'current-password');
    rerender(
      <AuthForm submitLabel="新規登録" onSubmit={vi.fn()} passwordAutoComplete="new-password" />,
    );
    expect(screen.getByLabelText('パスワード')).toHaveAttribute('autocomplete', 'new-password');
  });
});
