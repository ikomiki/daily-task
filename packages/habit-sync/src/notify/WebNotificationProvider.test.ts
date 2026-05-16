import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SlotSchedule } from './NotificationProvider.js';
import { WebNotificationProvider } from './WebNotificationProvider.js';

interface NotifInstance {
  title: string;
  body?: string;
}

// Notification グローバルをモック
class NotificationMock {
  static permission: 'granted' | 'denied' | 'default' = 'default';
  static requestPermissionMock = vi.fn();
  static requestPermission(): Promise<'granted' | 'denied' | 'default'> {
    return NotificationMock.requestPermissionMock();
  }
  title: string;
  body?: string;
  constructor(title: string, options?: { body?: string }) {
    this.title = title;
    this.body = options?.body;
    instances.push({ title, body: options?.body });
  }
}

let instances: NotifInstance[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  instances = [];
  NotificationMock.permission = 'default';
  NotificationMock.requestPermissionMock.mockReset();
  // biome-ignore lint/suspicious/noExplicitAny: テスト用グローバル差し替え
  (globalThis as any).Notification = NotificationMock;
});

afterEach(() => {
  vi.useRealTimers();
  // biome-ignore lint/suspicious/noExplicitAny: テスト用グローバル復元
  delete (globalThis as any).Notification;
});

function fixedNow(hh: number, mm: number): () => Date {
  return () => {
    const d = new Date(2026, 4, 16, hh, mm, 0, 0); // 2026-05-16 ローカル
    return d;
  };
}

describe('WebNotificationProvider', () => {
  it('requestPermission は Notification.requestPermission() を呼び 結果を正規化する', async () => {
    NotificationMock.requestPermissionMock.mockResolvedValue('granted');
    const provider = new WebNotificationProvider({ now: fixedNow(9, 0) });
    await expect(provider.requestPermission()).resolves.toBe('granted');
    expect(NotificationMock.requestPermissionMock).toHaveBeenCalled();
  });

  it('requestPermission の戻り値 "default" は "prompt" に正規化', async () => {
    NotificationMock.requestPermissionMock.mockResolvedValue('default');
    const provider = new WebNotificationProvider({ now: fixedNow(9, 0) });
    await expect(provider.requestPermission()).resolves.toBe('prompt');
  });

  it('Notification API 未対応環境では requestPermission が "denied" を返す', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    delete (globalThis as any).Notification;
    const provider = new WebNotificationProvider({ now: fixedNow(9, 0) });
    await expect(provider.requestPermission()).resolves.toBe('denied');
  });

  it('scheduleDaily: 未来時刻のスロットを setTimeout で予約し、時刻到達で onFire が呼ばれる', () => {
    const provider = new WebNotificationProvider({ now: fixedNow(8, 0) });
    const onFire = vi.fn();
    const slots: SlotSchedule[] = [
      { slotId: 's1', slotName: '朝', notifyAt: '09:00' },
      { slotId: 's2', slotName: '夜', notifyAt: '21:00' },
    ];
    provider.scheduleDaily(slots, onFire);

    // 09:00 まで進める（1 時間 = 60 * 60 * 1000ms）
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledWith(slots[0]);

    // さらに 12 時間進めて 21:00 へ
    vi.advanceTimersByTime(12 * 60 * 60 * 1000);
    expect(onFire).toHaveBeenCalledTimes(2);
    expect(onFire).toHaveBeenLastCalledWith(slots[1]);
  });

  it('scheduleDaily: 過去時刻のスロットは setTimeout を発行しない', () => {
    const provider = new WebNotificationProvider({ now: fixedNow(10, 0) });
    const onFire = vi.fn();
    provider.scheduleDaily([{ slotId: 's1', slotName: '朝', notifyAt: '09:00' }], onFire);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(onFire).not.toHaveBeenCalled();
  });

  it('cancelAll: 予約済みタイマーを全て解除する', () => {
    const provider = new WebNotificationProvider({ now: fixedNow(8, 0) });
    const onFire = vi.fn();
    provider.scheduleDaily([{ slotId: 's1', slotName: '朝', notifyAt: '09:00' }], onFire);
    provider.cancelAll();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(onFire).not.toHaveBeenCalled();
  });

  it('scheduleDaily を 2 回呼ぶと前回の予約は自動で cancel される', () => {
    const provider = new WebNotificationProvider({ now: fixedNow(8, 0) });
    const onFire1 = vi.fn();
    const onFire2 = vi.fn();
    provider.scheduleDaily([{ slotId: 's1', slotName: '朝', notifyAt: '09:00' }], onFire1);
    provider.scheduleDaily([{ slotId: 's2', slotName: '夜', notifyAt: '21:00' }], onFire2);
    vi.advanceTimersByTime(60 * 60 * 1000); // 09:00
    expect(onFire1).not.toHaveBeenCalled();
    vi.advanceTimersByTime(12 * 60 * 60 * 1000); // 21:00
    expect(onFire2).toHaveBeenCalledTimes(1);
  });

  it('show: permission=granted のとき new Notification(title, {body}) を発火', () => {
    NotificationMock.permission = 'granted';
    const provider = new WebNotificationProvider({ now: fixedNow(9, 0) });
    provider.show('朝のタスク', '3 件未完了');
    expect(instances).toEqual([{ title: '朝のタスク', body: '3 件未完了' }]);
  });

  it('show: permission!=granted のときは Notification を作らない', () => {
    NotificationMock.permission = 'denied';
    const provider = new WebNotificationProvider({ now: fixedNow(9, 0) });
    provider.show('朝のタスク');
    expect(instances).toEqual([]);
  });
});
