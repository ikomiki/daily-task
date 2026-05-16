import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// biome-ignore lint/complexity/noStaticOnlyClass: Notification API のグローバルモックに static クラスが必要
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
  // biome-ignore lint/suspicious/noExplicitAny: テスト用グローバル差し替え
  (globalThis as any).Notification = NotifMock;
});
afterEach(() => {
  // biome-ignore lint/suspicious/noExplicitAny: テスト用グローバル復元
  delete (globalThis as any).Notification;
});

import { useNotificationPermission } from './useNotificationPermission.js';

function Probe(): React.ReactElement {
  const { permission, request } = useNotificationPermission();
  return (
    <div>
      <span data-testid="perm">{permission}</span>
      <button
        type="button"
        onClick={() => {
          void request();
        }}
      >
        request
      </button>
    </div>
  );
}

describe('useNotificationPermission', () => {
  it('初期 permission=default のとき "prompt"', () => {
    render(<Probe />);
    expect(screen.getByTestId('perm')).toHaveTextContent('prompt');
  });

  it('Notification API 未対応では "unsupported"', () => {
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    delete (globalThis as any).Notification;
    render(<Probe />);
    expect(screen.getByTestId('perm')).toHaveTextContent('unsupported');
  });

  it('request() 後に granted へ遷移', async () => {
    NotifMock.requestPermissionMock.mockImplementation(async () => {
      NotifMock.permission = 'granted';
      return 'granted';
    });
    render(<Probe />);
    await act(async () => {
      screen.getByRole('button', { name: 'request' }).click();
    });
    expect(screen.getByTestId('perm')).toHaveTextContent('granted');
  });

  it('request() 後 denied のとき "denied"', async () => {
    NotifMock.requestPermissionMock.mockImplementation(async () => {
      NotifMock.permission = 'denied';
      return 'denied';
    });
    render(<Probe />);
    await act(async () => {
      screen.getByRole('button', { name: 'request' }).click();
    });
    expect(screen.getByTestId('perm')).toHaveTextContent('denied');
  });
});
