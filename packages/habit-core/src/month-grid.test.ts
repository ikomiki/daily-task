import { describe, expect, it } from 'vitest';
import { addMonths, endOfMonth, startOfMonth } from './month-grid.js';

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
