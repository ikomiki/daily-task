import type { DisplayTaskStatus, TaskStatus } from '@org/habit-sync';

// カレンダー画面でセルをクリックした時の次状態を返す。
// 戻り値 null は「empty に戻す（= clearTaskLogStatus を呼ぶ）」を意味する。
// 循環: empty → complete → fail → skip → empty
export function nextCalendarStatus(current: DisplayTaskStatus): TaskStatus | null {
  switch (current) {
    case 'empty':
      return 'complete';
    case 'complete':
      return 'fail';
    case 'fail':
      return 'skip';
    case 'skip':
      return null;
  }
}
