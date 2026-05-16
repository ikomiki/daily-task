import { describe, expect, it } from 'vitest';
import { formatHistoryStatus } from './history-status.js';

describe('formatHistoryStatus', () => {
  it('complete を「完了」に変換する', () => {
    expect(formatHistoryStatus('complete')).toBe('完了');
  });

  it('skip を「スキップ」に変換する', () => {
    expect(formatHistoryStatus('skip')).toBe('スキップ');
  });

  it('fail を「失敗」に変換する', () => {
    expect(formatHistoryStatus('fail')).toBe('失敗');
  });
});
