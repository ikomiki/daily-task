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

describe('isDueOn type=every_n_days', () => {
  const rule: Frequency = { type: 'every_n_days', n: 3, anchor: '2026-05-01' };
  const created = '2026-05-01';

  it('anchor 当日はマッチ', () => {
    expect(isDueOn(rule, '2026-05-01', created)).toBe(true);
  });

  it('anchor + 1 は false', () => {
    expect(isDueOn(rule, '2026-05-02', created)).toBe(false);
  });

  it('anchor + 2 は false', () => {
    expect(isDueOn(rule, '2026-05-03', created)).toBe(false);
  });

  it('anchor + 3 はマッチ', () => {
    expect(isDueOn(rule, '2026-05-04', created)).toBe(true);
  });

  it('anchor + 6 はマッチ', () => {
    expect(isDueOn(rule, '2026-05-07', created)).toBe(true);
  });

  it('anchor + 30 はマッチ（n=3 なので 30 / 3 = 10 サイクル）', () => {
    expect(isDueOn(rule, '2026-05-31', created)).toBe(true);
  });

  it('月跨ぎでも n 日周期', () => {
    // 2026-05-31 から +3 = 2026-06-03
    expect(isDueOn(rule, '2026-06-03', created)).toBe(true);
    expect(isDueOn(rule, '2026-06-02', created)).toBe(false);
  });

  it('anchor 前の日付は false（taskCreatedAt が anchor 以前でも）', () => {
    const r: Frequency = { type: 'every_n_days', n: 3, anchor: '2026-05-10' };
    expect(isDueOn(r, '2026-05-08', '2026-05-01')).toBe(false);
  });

  it('n=1 は daily と同等（anchor 以降）', () => {
    const r: Frequency = { type: 'every_n_days', n: 1, anchor: '2026-05-01' };
    expect(isDueOn(r, '2026-05-01', '2026-05-01')).toBe(true);
    expect(isDueOn(r, '2026-05-02', '2026-05-01')).toBe(true);
    expect(isDueOn(r, '2026-05-15', '2026-05-01')).toBe(true);
  });
});
