import type { TaskStatus } from '@org/habit-sync';

// TaskStatus を画面表示用の日本語ラベルに変換する。
// 'empty'（行不在）は履歴一覧では表示しないため対象外。
export function formatHistoryStatus(status: TaskStatus): string {
  switch (status) {
    case 'complete':
      return '完了';
    case 'skip':
      return 'スキップ';
    case 'fail':
      return '失敗';
  }
}
