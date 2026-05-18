import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppNav } from './AppNav.js';

// テスト用モックリンクコンポーネント（href を付与して link ロールを確保）
const MockLink: React.FC<{ to: string; className?: string; children: React.ReactNode }> = ({
  to,
  children,
  className,
}) => (
  <a href={to} className={className}>
    {children}
  </a>
);

const NAV_ITEMS = [
  { to: '/today', label: '今日' },
  { to: '/tasks', label: 'タスク' },
] as const;

describe('AppNav', () => {
  it('ナビゲーション項目をレンダリングする', () => {
    render(<AppNav items={NAV_ITEMS} linkComponent={MockLink} />);
    expect(screen.getByText('今日')).toBeDefined();
    expect(screen.getByText('タスク')).toBeDefined();
  });

  it('nav ロールの要素が存在する', () => {
    render(<AppNav items={NAV_ITEMS} linkComponent={MockLink} />);
    expect(screen.getByRole('navigation')).toBeDefined();
  });

  it('onSignOut が渡された場合にログアウトボタンが表示される', () => {
    const onSignOut = vi.fn();
    render(<AppNav items={NAV_ITEMS} linkComponent={MockLink} onSignOut={onSignOut} />);
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeDefined();
  });

  it('onSignOut が未指定の場合はログアウトボタンを表示しない', () => {
    render(<AppNav items={NAV_ITEMS} linkComponent={MockLink} />);
    expect(screen.queryByRole('button', { name: 'ログアウト' })).toBeNull();
  });

  it('ログアウトボタンをクリックすると onSignOut が呼ばれる', () => {
    const onSignOut = vi.fn();
    render(<AppNav items={NAV_ITEMS} linkComponent={MockLink} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('リンクに border-gray-500 クラスが適用される', () => {
    render(<AppNav items={NAV_ITEMS} linkComponent={MockLink} />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      expect(link.className).toContain('border-gray-500');
    }
  });
});
