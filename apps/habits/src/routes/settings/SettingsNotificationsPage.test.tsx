import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}));

// biome-ignore lint/complexity/noStaticOnlyClass: テスト用 Notification API モック
class NotifMock {
  static permission: 'granted' | 'denied' | 'default' = 'default';
  static requestPermissionMock = vi.fn();
  static requestPermission(): Promise<'granted' | 'denied' | 'default'> {
    return NotifMock.requestPermissionMock();
  }
}

beforeEach(() => {
  NotifMock.permission = 'default';
  NotifMock.requestPermissionMock.mockReset();
  // biome-ignore lint/suspicious/noExplicitAny: テスト用
  (globalThis as any).Notification = NotifMock;
});
afterEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: テスト用
  delete (globalThis as any).Notification;
});

import { SettingsNotificationsPage } from './SettingsNotificationsPage.js';

describe('SettingsNotificationsPage', () => {
  it('「通知設定」見出しを表示', () => {
    render(<SettingsNotificationsPage />);
    expect(screen.getByRole('heading', { name: '通知設定' })).toBeInTheDocument();
  });

  it('初期 permission=default のとき「未許可」と表示し、許可ボタンを出す', () => {
    render(<SettingsNotificationsPage />);
    expect(screen.getByText(/未許可/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通知を許可する' })).toBeInTheDocument();
  });

  it('permission=granted のとき「許可済み」表示で許可ボタンは非表示', () => {
    NotifMock.permission = 'granted';
    render(<SettingsNotificationsPage />);
    expect(screen.getByText(/許可済み/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '通知を許可する' })).not.toBeInTheDocument();
  });

  it('permission=denied のとき「拒否」表示で許可ボタンは非表示', () => {
    NotifMock.permission = 'denied';
    render(<SettingsNotificationsPage />);
    expect(screen.getByText(/拒否/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '通知を許可する' })).not.toBeInTheDocument();
  });

  it('ボタンクリックで requestPermission が呼ばれ、許可後は「許可済み」表示に切替', async () => {
    NotifMock.requestPermissionMock.mockImplementation(async () => {
      NotifMock.permission = 'granted';
      return 'granted';
    });
    render(<SettingsNotificationsPage />);
    fireEvent.click(screen.getByRole('button', { name: '通知を許可する' }));
    await waitFor(() => {
      expect(screen.getByText(/許可済み/)).toBeInTheDocument();
    });
  });

  it('Notification API 未対応では「お使いのブラウザは通知非対応」と表示', () => {
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    delete (globalThis as any).Notification;
    render(<SettingsNotificationsPage />);
    expect(screen.getByText(/通知非対応/)).toBeInTheDocument();
  });

  it('時間帯設定 / 今日のタスクへ戻るリンクを表示する', () => {
    render(<SettingsNotificationsPage />);
    expect(screen.getByRole('link', { name: '時間帯' })).toHaveAttribute(
      'href',
      '/settings/time-slots',
    );
    expect(screen.getByRole('link', { name: '今日のタスク' })).toHaveAttribute('href', '/today');
  });
});
