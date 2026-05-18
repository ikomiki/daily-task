import { describe, expect, it } from 'vitest';
import { nextCalendarStatus } from './calendar-status.js';

describe('nextCalendarStatus', () => {
  it('empty → complete', () => {
    expect(nextCalendarStatus('empty')).toBe('complete');
  });
  it('complete → fail', () => {
    expect(nextCalendarStatus('complete')).toBe('fail');
  });
  it('fail → skip', () => {
    expect(nextCalendarStatus('fail')).toBe('skip');
  });
  it('skip → empty (null として返す)', () => {
    expect(nextCalendarStatus('skip')).toBeNull();
  });
});
