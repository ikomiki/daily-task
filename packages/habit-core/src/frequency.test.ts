import { describe, expect, it } from 'vitest';
import { type Frequency, isDueOn } from './frequency.js';

describe('isDueOn 共通ガード', () => {
  it('タスク作成日より前の日付は常に false', () => {
    const rule: Frequency = { type: 'daily' };
    expect(isDueOn(rule, '2026-05-15', '2026-05-16')).toBe(false);
  });

  it('タスク作成日当日は評価対象（daily なら true）', () => {
    const rule: Frequency = { type: 'daily' };
    expect(isDueOn(rule, '2026-05-16', '2026-05-16')).toBe(true);
  });
});

describe('isDueOn type=daily', () => {
  it('すべての日が true', () => {
    const rule: Frequency = { type: 'daily' };
    expect(isDueOn(rule, '2026-05-16', '2026-01-01')).toBe(true);
    expect(isDueOn(rule, '2026-12-31', '2026-01-01')).toBe(true);
    expect(isDueOn(rule, '2027-01-01', '2026-01-01')).toBe(true);
  });
});
