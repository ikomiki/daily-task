import { describe, expect, it, vi } from 'vitest';

const loadTaskHistoryMock = vi.fn();
vi.mock('@org/habit-sync', () => ({
  loadTaskHistory: (...args: unknown[]): unknown => loadTaskHistoryMock(...args),
}));

import { loadTaskLogsInRange } from './calendar-fetch-range.js';

describe('loadTaskLogsInRange', () => {
  it('grid 全期間を beforeDate=最終日+1, limit=42 で取得', async () => {
    loadTaskHistoryMock.mockResolvedValueOnce([
      { task_id: 't1', date: '2026-04-30', status: 'complete' },
    ]);
    const client = {} as unknown;
    const rows = await loadTaskLogsInRange(client, {
      taskId: 't1',
      firstDay: '2026-04-26',
      lastDay: '2026-06-06',
    });
    expect(loadTaskHistoryMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ taskId: 't1', beforeDate: '2026-06-07', limit: 42 }),
    );
    expect(rows).toHaveLength(1);
  });

  it('firstDay より前の行は除外', async () => {
    loadTaskHistoryMock.mockResolvedValueOnce([
      { task_id: 't1', date: '2026-04-30', status: 'complete' },
      { task_id: 't1', date: '2026-04-25', status: 'fail' }, // 範囲外
    ]);
    const rows = await loadTaskLogsInRange({} as unknown, {
      taskId: 't1',
      firstDay: '2026-04-26',
      lastDay: '2026-06-06',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-04-30');
  });
});
