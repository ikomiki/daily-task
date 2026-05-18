import { describe, expect, it } from 'vitest';
import { addMonths, buildCalendarGrid, endOfMonth, startOfMonth } from './month-grid.js';

describe('month-grid.startOfMonth', () => {
  it('月初を返す', () => {
    expect(startOfMonth('2026-05-18')).toBe('2026-05-01');
  });
  it('既に月初ならそのまま', () => {
    expect(startOfMonth('2026-05-01')).toBe('2026-05-01');
  });
});

describe('month-grid.endOfMonth', () => {
  it('31 日月の月末', () => {
    expect(endOfMonth('2026-05-15')).toBe('2026-05-31');
  });
  it('30 日月の月末', () => {
    expect(endOfMonth('2026-04-10')).toBe('2026-04-30');
  });
  it('閏年 2 月の月末', () => {
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29');
  });
  it('非閏年 2 月の月末', () => {
    expect(endOfMonth('2025-02-10')).toBe('2025-02-28');
  });
});

describe('month-grid.addMonths', () => {
  it('+1 で翌月の月初に揃える', () => {
    expect(addMonths('2026-05-18', 1)).toBe('2026-06-01');
  });
  it('-1 で前月の月初に揃える', () => {
    expect(addMonths('2026-05-18', -1)).toBe('2026-04-01');
  });
  it('+12 で翌年同月の月初', () => {
    expect(addMonths('2026-05-18', 12)).toBe('2027-05-01');
  });
  it('-5 で年跨ぎ', () => {
    expect(addMonths('2026-03-15', -5)).toBe('2025-10-01');
  });
});

describe('month-grid.buildCalendarGrid', () => {
  // 2026-05-01 は金曜（ISO 5）。日曜始まりなので前月から 5 セル必要。
  it('2026-05 を 42 セルで返す（日曜始まり）', () => {
    const cells = buildCalendarGrid('2026-05');
    expect(cells).toHaveLength(42);
    expect(cells[0]).toBe('2026-04-26'); // 日曜
    expect(cells[5]).toBe('2026-05-01'); // 金曜（月初）
    expect(cells[35]).toBe('2026-05-31'); // 月末
    expect(cells[41]).toBe('2026-06-06'); // 翌月オーバーラップ末
  });

  it('2026-02 (日曜始まり) は前月オーバーラップ 0 セル', () => {
    const cells = buildCalendarGrid('2026-02');
    expect(cells[0]).toBe('2026-02-01'); // 日曜
    expect(cells[27]).toBe('2026-02-28');
    expect(cells).toHaveLength(42);
  });

  it('閏年 2024-02 を 42 セルで返す', () => {
    const cells = buildCalendarGrid('2024-02');
    // 2024-02-01 は木曜 → 前月 4 セル
    expect(cells[0]).toBe('2024-01-28');
    expect(cells[3]).toBe('2024-01-31');
    expect(cells[4]).toBe('2024-02-01');
    expect(cells[32]).toBe('2024-02-29'); // 閏日
    expect(cells).toHaveLength(42);
  });

  it('全セルは連続した日付（差分 1 日）', () => {
    const cells = buildCalendarGrid('2026-05');
    for (let i = 1; i < cells.length; i++) {
      const prev = new Date(cells[i - 1]);
      const cur = new Date(cells[i]);
      expect(cur.getTime() - prev.getTime()).toBe(86_400_000);
    }
  });
});
