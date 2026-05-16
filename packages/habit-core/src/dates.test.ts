import { describe, expect, it } from 'vitest';
import { isoDayOfWeek, toUtcDays, weekOfMonth } from './dates.js';

describe('dates.toUtcDays', () => {
  it('1970-01-01 を 0 として返す', () => {
    expect(toUtcDays('1970-01-01')).toBe(0);
  });

  it('1970-01-02 は 1', () => {
    expect(toUtcDays('1970-01-02')).toBe(1);
  });

  it('日数差はカレンダー日数と一致する', () => {
    expect(toUtcDays('2026-05-16') - toUtcDays('2026-05-15')).toBe(1);
    expect(toUtcDays('2024-03-01') - toUtcDays('2024-02-29')).toBe(1); // 閏年
    expect(toUtcDays('2025-03-01') - toUtcDays('2025-02-28')).toBe(1); // 非閏年
  });

  it('年跨ぎでも 1 日差', () => {
    expect(toUtcDays('2027-01-01') - toUtcDays('2026-12-31')).toBe(1);
  });
});

describe('dates.isoDayOfWeek', () => {
  // 2026-05-11 は月曜（既知の基準日: ISO 1）
  it('月曜は 1', () => {
    expect(isoDayOfWeek('2026-05-11')).toBe(1);
  });
  it('火曜は 2', () => {
    expect(isoDayOfWeek('2026-05-12')).toBe(2);
  });
  it('水曜は 3', () => {
    expect(isoDayOfWeek('2026-05-13')).toBe(3);
  });
  it('木曜は 4', () => {
    expect(isoDayOfWeek('2026-05-14')).toBe(4);
  });
  it('金曜は 5', () => {
    expect(isoDayOfWeek('2026-05-15')).toBe(5);
  });
  it('土曜は 6', () => {
    expect(isoDayOfWeek('2026-05-16')).toBe(6);
  });
  it('日曜は 7', () => {
    expect(isoDayOfWeek('2026-05-17')).toBe(7);
  });
});

describe('dates.weekOfMonth', () => {
  it('1〜7 日は第 1 週', () => {
    expect(weekOfMonth('2026-05-01')).toBe(1);
    expect(weekOfMonth('2026-05-07')).toBe(1);
  });
  it('8〜14 日は第 2 週', () => {
    expect(weekOfMonth('2026-05-08')).toBe(2);
    expect(weekOfMonth('2026-05-14')).toBe(2);
  });
  it('15〜21 日は第 3 週', () => {
    expect(weekOfMonth('2026-05-21')).toBe(3);
  });
  it('22〜28 日は第 4 週', () => {
    expect(weekOfMonth('2026-05-22')).toBe(4);
    expect(weekOfMonth('2026-05-28')).toBe(4);
  });
  it('29〜31 日は第 5 週', () => {
    expect(weekOfMonth('2026-05-29')).toBe(5);
    expect(weekOfMonth('2026-05-31')).toBe(5);
  });
});
