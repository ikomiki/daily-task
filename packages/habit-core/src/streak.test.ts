import { describe, expect, it } from 'vitest';
import { calculateStreak, type LogEntry } from './streak.js';

function logs(entries: Array<[string, 'complete' | 'skip' | 'fail']>): LogEntry[] {
  return entries.map(([date, status]) => ({ date, status }));
}

describe('calculateStreak', () => {
  it('空配列は 0', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('1 件 complete は 1', () => {
    expect(calculateStreak(logs([['2026-05-16', 'complete']]))).toBe(1);
  });

  it('1 件 skip は 0', () => {
    expect(calculateStreak(logs([['2026-05-16', 'skip']]))).toBe(0);
  });

  it('1 件 fail は 0', () => {
    expect(calculateStreak(logs([['2026-05-16', 'fail']]))).toBe(0);
  });

  it('連続 complete 3 件は 3', () => {
    expect(
      calculateStreak(
        logs([
          ['2026-05-14', 'complete'],
          ['2026-05-15', 'complete'],
          ['2026-05-16', 'complete'],
        ]),
      ),
    ).toBe(3);
  });

  it('skip は streak 維持（数えない）', () => {
    // complete, skip, complete → 2（最新から見て skip は壁にならない）
    expect(
      calculateStreak(
        logs([
          ['2026-05-14', 'complete'],
          ['2026-05-15', 'skip'],
          ['2026-05-16', 'complete'],
        ]),
      ),
    ).toBe(2);
  });

  it('末尾に skip があっても、その前の complete までを数える', () => {
    // complete, complete, skip → 2
    expect(
      calculateStreak(
        logs([
          ['2026-05-14', 'complete'],
          ['2026-05-15', 'complete'],
          ['2026-05-16', 'skip'],
        ]),
      ),
    ).toBe(2);
  });

  it('fail が出ると streak リセット（fail より後ろのみ数える）', () => {
    // complete, fail, complete → 1（最新の complete のみ）
    expect(
      calculateStreak(
        logs([
          ['2026-05-14', 'complete'],
          ['2026-05-15', 'fail'],
          ['2026-05-16', 'complete'],
        ]),
      ),
    ).toBe(1);
  });

  it('末尾が fail は 0（streak が完全に切れた状態）', () => {
    expect(
      calculateStreak(
        logs([
          ['2026-05-14', 'complete'],
          ['2026-05-15', 'complete'],
          ['2026-05-16', 'fail'],
        ]),
      ),
    ).toBe(0);
  });

  it('複合: fail → skip → complete → complete → skip → complete = 3', () => {
    // 末尾から遡って fail が出るまでに含まれる complete の数: 3
    expect(
      calculateStreak(
        logs([
          ['2026-05-10', 'fail'],
          ['2026-05-11', 'skip'],
          ['2026-05-12', 'complete'],
          ['2026-05-13', 'complete'],
          ['2026-05-14', 'skip'],
          ['2026-05-15', 'complete'],
        ]),
      ),
    ).toBe(3);
  });

  it('複合: 最古の fail があっても、それより新しい complete のみが streak', () => {
    expect(
      calculateStreak(
        logs([
          ['2026-05-10', 'fail'],
          ['2026-05-11', 'complete'],
          ['2026-05-12', 'complete'],
          ['2026-05-13', 'complete'],
        ]),
      ),
    ).toBe(3);
  });
});
