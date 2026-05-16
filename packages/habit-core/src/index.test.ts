import { describe, expect, it } from 'vitest';
import type { DisplayTaskStatus, Frequency, LogEntry, TaskStatus } from './index.js';
import { calculateStreak, isDueOn } from './index.js';

describe('@org/habit-core 公開 API スモーク', () => {
  it('型 Frequency が判別可能であること', () => {
    const f: Frequency = { type: 'daily' };
    expect(f.type).toBe('daily');
  });

  it('TaskStatus と DisplayTaskStatus が想定の値を取れること', () => {
    const s: TaskStatus = 'complete';
    const d: DisplayTaskStatus = 'empty';
    expect([s, d]).toEqual(['complete', 'empty']);
  });

  it('LogEntry を配列で扱えること', () => {
    const logs: LogEntry[] = [{ date: '2026-05-16', status: 'complete' }];
    expect(logs).toHaveLength(1);
  });

  it.skip('isDueOn は M4 完了で実装済（Task 9 で本来のスモークテストに置換予定）', () => {});
  it.skip('calculateStreak は M4 完了で実装済（Task 9 で本来のスモークテストに置換予定）', () => {});
});
