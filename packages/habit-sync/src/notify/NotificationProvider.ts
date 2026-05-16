// 通知バックエンドの抽象。
// v1 = WebNotificationProvider（フォアグラウンドのみ）
// 将来 = TauriNotificationProvider（tauri-plugin-notification）
// 詳細: docs/superpowers/specs/2026-05-16-habits-app-design.md §7.3

export type PermissionState = 'granted' | 'denied' | 'prompt';

export interface SlotSchedule {
  slotId: string;
  slotName: string;
  notifyAt: string; // 'HH:MM' 形式（ローカル）
}

export interface NotificationProvider {
  requestPermission(): Promise<PermissionState>;
  scheduleDaily(slots: SlotSchedule[]): void;
  cancelAll(): void;
}
