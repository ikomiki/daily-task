import { describe, expect, it } from 'vitest';
import { type Frequency, isDueOn } from './frequency.js';

describe('isDueOn エッジケース: 閏年 2/29', () => {
  const created = '2024-01-01';

  it('every_n_days: anchor=2024-02-01, n=28 で 2024-02-29 はマッチ', () => {
    const rule: Frequency = { type: 'every_n_days', n: 28, anchor: '2024-02-01' };
    expect(isDueOn(rule, '2024-02-29', created)).toBe(true);
  });

  it('weekday: 2024-02-29（木）は days=[4] にマッチ', () => {
    const rule: Frequency = { type: 'weekday', days: [4] };
    expect(isDueOn(rule, '2024-02-29', created)).toBe(true);
  });

  it('day_of_week: 2024-02-29 は第 5 木曜（weeks_of_month=[5] にマッチ）', () => {
    const rule: Frequency = { type: 'day_of_week', days: [4], weeks_of_month: [5] };
    expect(isDueOn(rule, '2024-02-29', created)).toBe(true);
  });

  it('every_n_days: 2024-03-01 は 2024-02-29 の翌日として扱われる（閏年）', () => {
    const rule: Frequency = { type: 'every_n_days', n: 1, anchor: '2024-02-29' };
    expect(isDueOn(rule, '2024-03-01', created)).toBe(true);
  });
});

describe('isDueOn エッジケース: 月末 30/31 日', () => {
  const created = '2026-01-01';

  // 2026-05-31 は日曜（ISO 7）。2026-05-01 が金曜のため +30 で日曜。
  it('weekday: 5/31 は日曜 days=[7] にマッチ', () => {
    const rule: Frequency = { type: 'weekday', days: [7] };
    expect(isDueOn(rule, '2026-05-31', created)).toBe(true);
  });

  it('day_of_week: 5/31 は第 5 日曜（weeks_of_month=[5] / days=[7] でマッチ）', () => {
    const rule: Frequency = { type: 'day_of_week', days: [7], weeks_of_month: [5] };
    expect(isDueOn(rule, '2026-05-31', created)).toBe(true);
  });

  it('every_n_days: 2026-05-31 → 2026-06-01 は連続日扱い', () => {
    const rule: Frequency = { type: 'every_n_days', n: 1, anchor: '2026-05-31' };
    expect(isDueOn(rule, '2026-06-01', created)).toBe(true);
  });

  it('every_n_days: anchor=2026-05-31, n=30 で 2026-06-30 はマッチ', () => {
    const rule: Frequency = { type: 'every_n_days', n: 30, anchor: '2026-05-31' };
    expect(isDueOn(rule, '2026-06-30', created)).toBe(true);
  });
});

describe('isDueOn エッジケース: 第 5 週が存在しない月', () => {
  const created = '2026-01-01';

  it('day_of_week + weeks_of_month=[5]: 第 5 週が存在しない月では false', () => {
    // 2026-02 の最終日は 2/28 (土曜)。日数 28 / 7 = 4 → 最大第 4 週
    const rule: Frequency = { type: 'day_of_week', days: [6], weeks_of_month: [5] };
    expect(isDueOn(rule, '2026-02-21', created)).toBe(false);
    expect(isDueOn(rule, '2026-02-28', created)).toBe(false);
  });
});

describe('isDueOn エッジケース: 年跨ぎ', () => {
  const created = '2026-01-01';

  it('every_n_days: 2026-12-31 → 2027-01-01 は連続日扱い', () => {
    const rule: Frequency = { type: 'every_n_days', n: 1, anchor: '2026-12-31' };
    expect(isDueOn(rule, '2027-01-01', created)).toBe(true);
  });

  it('every_n_weeks: 2026 年末から翌年への 14 日周期が成立する', () => {
    // anchor=2026-12-26（土）, n=2, day_of_week=6
    // first_match=2026-12-26, +14 = 2027-01-09, +14 = 2027-01-23
    const rule: Frequency = {
      type: 'every_n_weeks',
      n: 2,
      day_of_week: 6,
      anchor: '2026-12-26',
    };
    expect(isDueOn(rule, '2027-01-09', created)).toBe(true);
    expect(isDueOn(rule, '2027-01-23', created)).toBe(true);
    expect(isDueOn(rule, '2027-01-16', created)).toBe(false);
  });

  it('weekday: 年末月曜 2026-12-28 は days=[1] にマッチ', () => {
    const rule: Frequency = { type: 'weekday', days: [1] };
    expect(isDueOn(rule, '2026-12-28', created)).toBe(true);
  });
});

describe('isDueOn エッジケース: anchor 当日 vs 前後', () => {
  it('every_n_days: anchor 当日はマッチ（taskCreatedAt と一致しても）', () => {
    const rule: Frequency = { type: 'every_n_days', n: 7, anchor: '2026-05-16' };
    expect(isDueOn(rule, '2026-05-16', '2026-05-16')).toBe(true);
  });

  it('every_n_days: anchor の 1 日前は false', () => {
    const rule: Frequency = { type: 'every_n_days', n: 7, anchor: '2026-05-16' };
    expect(isDueOn(rule, '2026-05-15', '2026-05-15')).toBe(false);
  });

  it('every_n_weeks: anchor 当日が指定曜日でない場合、最初のマッチは offset 日後', () => {
    // anchor=2026-05-16（土曜）, day_of_week=1（月曜）
    // first_match = anchor + (1 - 6 + 7) % 7 = anchor + 2 = 2026-05-18（月）
    const rule: Frequency = { type: 'every_n_weeks', n: 1, day_of_week: 1, anchor: '2026-05-16' };
    expect(isDueOn(rule, '2026-05-16', '2026-05-16')).toBe(false);
    expect(isDueOn(rule, '2026-05-18', '2026-05-16')).toBe(true);
  });
});
