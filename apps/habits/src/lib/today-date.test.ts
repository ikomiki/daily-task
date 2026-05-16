import { describe, expect, it } from 'vitest';
import { getTodayDateString } from './today-date.js';

describe('getTodayDateString', () => {
  it('引数の Date から YYYY-MM-DD を返す', () => {
    expect(getTodayDateString(new Date(2026, 4, 16, 9, 30))).toBe('2026-05-16');
  });

  it('月と日が 1 桁の場合はゼロパディングされる', () => {
    expect(getTodayDateString(new Date(2026, 0, 3, 0, 0))).toBe('2026-01-03');
  });

  it('深夜は当日の日付（タイムゾーン非依存、ローカル時刻ベース）', () => {
    expect(getTodayDateString(new Date(2026, 4, 16, 23, 59))).toBe('2026-05-16');
  });

  it('引数なしの場合は new Date() のローカル日付を返す（形式チェックのみ）', () => {
    const today = getTodayDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
