import { observable } from '@legendapp/state';
import { describe, expect, it } from 'vitest';
import { getPendingSyncCount } from './pending-sync.js';

describe('getPendingSyncCount', () => {
  it('同期未接続の observable では 0 を返す', () => {
    const s$ = observable({
      tasks: {} as Record<string, unknown>,
      time_slots: {} as Record<string, unknown>,
      task_logs: {} as Record<string, unknown>,
    });
    expect(getPendingSyncCount(s$)).toBe(0);
  });

  it('観測対象キーが無い state$ でも 0 を返す（防御的）', () => {
    const s$ = observable({});
    expect(getPendingSyncCount(s$ as never)).toBe(0);
  });
});
