import type { TaskStatus } from './status.js';

// 日付昇順の log 一覧から最新の連続完了数（streak）を算出する。
// ルール:
//   - complete: streak +1
//   - skip:     streak 維持（増えない）
//   - fail:     streak を 0 にリセット
//   - 頻度外:   呼び出し側で除外して渡す
// 実装本体は M4 で行う。
export interface LogEntry {
  date: string; // 'YYYY-MM-DD'
  status: TaskStatus;
}

export function calculateStreak(logsAsc: LogEntry[]): number {
  let streak = 0;
  // 末尾から走査して fail が出たら打ち切り。complete は加算、skip は無視。
  for (let i = logsAsc.length - 1; i >= 0; i--) {
    const status = logsAsc[i].status;
    if (status === 'fail') {
      break;
    }
    if (status === 'complete') {
      streak += 1;
    }
    // skip は何もしない（streak 維持）
  }
  return streak;
}
