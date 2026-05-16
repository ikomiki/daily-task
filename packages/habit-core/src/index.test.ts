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

  it('isDueOn が頻度判定を返すこと（公開 API スモーク）', () => {
    expect(isDueOn({ type: 'daily' }, '2026-05-16', '2026-05-16')).toBe(true);
    expect(isDueOn({ type: 'weekday', days: [6] }, '2026-05-16', '2026-01-01')).toBe(true);
  });

  it('calculateStreak が連続完了数を返すこと（公開 API スモーク）', () => {
    expect(calculateStreak([])).toBe(0);
    expect(
      calculateStreak([
        { date: '2026-05-15', status: 'complete' },
        { date: '2026-05-16', status: 'complete' },
      ]),
    ).toBe(2);
  });
});
