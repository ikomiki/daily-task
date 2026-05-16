import type {
  NotificationProvider,
  PermissionState,
  SlotSchedule,
} from './NotificationProvider.js';

export interface WebNotificationProviderOptions {
  // テストで時計を制御するための DI。本番は () => new Date()
  now?: () => Date;
}

// "HH:MM" または "HH:MM:SS" を [hour, minute] に分解
function parseNotifyAt(notifyAt: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(notifyAt);
  if (m === null) {
    return null;
  }
  const hour = Number.parseInt(m[1], 10);
  const minute = Number.parseInt(m[2], 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  return { hour, minute };
}

// ブラウザ環境向けの NotificationProvider 実装（v1: フォアグラウンドのみ）。
// - requestPermission: Notification.requestPermission() を呼び 'default' を 'prompt' に正規化
// - scheduleDaily: 各 slot の notifyAt 時刻（今日のローカル時刻）まで setTimeout で予約
//   - 既に予約済みのタイマーがあれば自動で cancelAll してから再予約
//   - 過去時刻のスロットはスキップ（v1 は当日中のみ）
// - cancelAll: 全タイマー解除
// - show: permission=granted の場合のみ new Notification(...)
export class WebNotificationProvider implements NotificationProvider {
  private timerIds: number[] = [];
  private readonly now: () => Date;

  constructor(options: WebNotificationProviderOptions = {}) {
    this.now = options.now ?? ((): Date => new Date());
  }

  async requestPermission(): Promise<PermissionState> {
    if (typeof globalThis.Notification === 'undefined') {
      return 'denied';
    }
    const result = await globalThis.Notification.requestPermission();
    if (result === 'granted') {
      return 'granted';
    }
    if (result === 'denied') {
      return 'denied';
    }
    return 'prompt';
  }

  scheduleDaily(slots: SlotSchedule[], onFire: (slot: SlotSchedule) => void): void {
    this.cancelAll();
    const now = this.now();
    for (const slot of slots) {
      const parsed = parseNotifyAt(slot.notifyAt);
      if (parsed === null) {
        continue;
      }
      const target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        parsed.hour,
        parsed.minute,
        0,
        0,
      );
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) {
        // 過去時刻はスキップ（v1 は当日中のみ）
        continue;
      }
      // setTimeout の戻り値は Node では NodeJS.Timeout、ブラウザでは number。
      // unknown 経由でキャストして number として保持する。
      const id = setTimeout(() => {
        onFire(slot);
      }, diff) as unknown as number;
      this.timerIds.push(id);
    }
  }

  cancelAll(): void {
    for (const id of this.timerIds) {
      clearTimeout(id);
    }
    this.timerIds = [];
  }

  show(title: string, body?: string): void {
    if (typeof globalThis.Notification === 'undefined') {
      return;
    }
    if (globalThis.Notification.permission !== 'granted') {
      return;
    }
    new globalThis.Notification(title, body !== undefined ? { body } : undefined);
  }
}
