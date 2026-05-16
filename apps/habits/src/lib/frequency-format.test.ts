import type { Frequency } from '@org/habit-core';
import { describe, expect, it } from 'vitest';
import { formatFrequency } from './frequency-format.js';

describe('formatFrequency', () => {
  it('daily → 「毎日」', () => {
    expect(formatFrequency({ type: 'daily' })).toBe('毎日');
  });

  it('every_n_days n=3 → 「3 日ごと（開始: 2026-05-01）」', () => {
    expect(formatFrequency({ type: 'every_n_days', n: 3, anchor: '2026-05-01' })).toBe(
      '3 日ごと（開始: 2026-05-01）',
    );
  });

  it('every_n_days n=1 → 「1 日ごと（開始: ...）」', () => {
    expect(formatFrequency({ type: 'every_n_days', n: 1, anchor: '2026-05-16' })).toBe(
      '1 日ごと（開始: 2026-05-16）',
    );
  });

  it('weekday days=[1,2,3,4,5] → 「月火水木金」', () => {
    expect(formatFrequency({ type: 'weekday', days: [1, 2, 3, 4, 5] })).toBe('月火水木金');
  });

  it('weekday days=[6,7] → 「土日」', () => {
    expect(formatFrequency({ type: 'weekday', days: [6, 7] })).toBe('土日');
  });

  it('weekday days=[] → 「なし」', () => {
    expect(formatFrequency({ type: 'weekday', days: [] })).toBe('なし');
  });

  it('day_of_week days=[4] no weeks_of_month → 「毎週木曜」', () => {
    expect(formatFrequency({ type: 'day_of_week', days: [4] })).toBe('毎週木曜');
  });

  it('day_of_week days=[4] weeks_of_month=[2,4] → 「第 2/4 木曜」', () => {
    const f: Frequency = { type: 'day_of_week', days: [4], weeks_of_month: [2, 4] };
    expect(formatFrequency(f)).toBe('第 2/4 木曜');
  });

  it('day_of_week 複数曜日 weeks_of_month あり → 「第 2/4 月水金」', () => {
    const f: Frequency = { type: 'day_of_week', days: [1, 3, 5], weeks_of_month: [2, 4] };
    expect(formatFrequency(f)).toBe('第 2/4 月水金');
  });

  it('every_n_weeks n=2 day_of_week=6 → 「2 週ごと土曜（開始: 2026-05-01）」', () => {
    const f: Frequency = { type: 'every_n_weeks', n: 2, day_of_week: 6, anchor: '2026-05-01' };
    expect(formatFrequency(f)).toBe('2 週ごと土曜（開始: 2026-05-01）');
  });
});
