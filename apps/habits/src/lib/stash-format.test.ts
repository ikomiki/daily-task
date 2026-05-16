import { describe, expect, it } from 'vitest';
import { formatCompletionRate, formatLastCompletedDate, formatStashCount } from './stash-format.js';

describe('formatStashCount', () => {
  it('number 値はそのまま文字列で返す', () => {
    expect(formatStashCount(0)).toBe('0');
    expect(formatStashCount(7)).toBe('7');
  });

  it('null は 0 として扱う', () => {
    expect(formatStashCount(null)).toBe('0');
  });
});

describe('formatCompletionRate', () => {
  it('0.0–1.0 の値を整数パーセントに変換する', () => {
    expect(formatCompletionRate(0)).toBe('0%');
    expect(formatCompletionRate(0.5)).toBe('50%');
    expect(formatCompletionRate(1)).toBe('100%');
  });

  it('小数は四捨五入する', () => {
    expect(formatCompletionRate(0.6234)).toBe('62%');
    expect(formatCompletionRate(0.6789)).toBe('68%');
  });

  it('null は「—」を返す（分母 0 を意味する）', () => {
    expect(formatCompletionRate(null)).toBe('—');
  });
});

describe('formatLastCompletedDate', () => {
  it('YYYY-MM-DD はそのまま返す', () => {
    expect(formatLastCompletedDate('2026-05-16')).toBe('2026-05-16');
  });

  it('null は「—」を返す', () => {
    expect(formatLastCompletedDate(null)).toBe('—');
  });
});
