import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppNav, isNavItemActive } from './AppNav.js';

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

  it('リンクに border-border-strong クラスが適用される', () => {
    render(<AppNav items={NAV_ITEMS} linkComponent={MockLink} currentPath="/other" />);
    const links = screen.getAllByRole('link');
    for (const link of links) {
      expect(link.className).toContain('border-border-strong');
    }
  });

  it('currentPath と一致する項目はアクティブクラスが適用される', () => {
    render(<AppNav items={NAV_ITEMS} linkComponent={MockLink} currentPath="/today" />);
    const todayLink = screen.getByText('今日').closest('a');
    expect(todayLink?.className).toContain('border-game-accent');
  });
});

describe('isNavItemActive', () => {
  it('/today と /today は active', () => expect(isNavItemActive('/today', '/today')).toBe(true));
  it('/tasks と /tasks/new は active', () =>
    expect(isNavItemActive('/tasks', '/tasks/new')).toBe(true));
  it('/tasks と /tasksfoo は active でない', () =>
    expect(isNavItemActive('/tasks', '/tasksfoo')).toBe(false));
  it('/ と /today は active でない', () => expect(isNavItemActive('/', '/today')).toBe(false));
  it('/settings と /settings/notifications は active', () =>
    expect(isNavItemActive('/settings', '/settings/notifications')).toBe(true));
});
