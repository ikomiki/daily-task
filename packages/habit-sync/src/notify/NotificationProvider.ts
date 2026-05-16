// 通知バックエンドの抽象。
// v1 = WebNotificationProvider（フォアグラウンドのみ）
// 将来 = TauriNotificationProvider（tauri-plugin-notification）
// 詳細: docs/superpowers/specs/2026-05-16-habits-app-design.md §7.3

export type PermissionState = 'granted' | 'denied' | 'prompt';

export interface SlotSchedule {
  slotId: string;
  slotName: string;
  notifyAt: string; // 'HH:MM' または 'HH:MM:SS' 形式（ローカル）
}

// scheduleDaily の onFire は、各スロットの notifyAt 時刻に呼び出される。
// 呼び出された側で state$ から「未操作タスク」を抽出し、provider.show() で通知発火する。
// この間接化により、scheduleDaily 時点の snapshot ではなく発火時点の最新 state で判定できる。
export interface NotificationProvider {
  requestPermission(): Promise<PermissionState>;
  scheduleDaily(slots: SlotSchedule[], onFire: (slot: SlotSchedule) => void): void;
  cancelAll(): void;
  show(title: string, body?: string): void;
}
