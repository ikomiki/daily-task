import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureSyncPersistence } from './persist.js';
import { getTaskLogsCutoffDate, setupSync } from './sync.js';

// IndexedDB の persist plugin を登録しないと syncObservable が unhandled rejection を出すため、
// setupSync describe ブロックの前に global に登録しておく。
const TABLE_NAMES = ['time_slots', 'tasks', 'task_logs', 'task_stash_view'];

describe('getTaskLogsCutoffDate', () => {
  it('today から 31 日前の YYYY-MM-DD を返す', () => {
    expect(getTaskLogsCutoffDate('2026-05-16')).toBe('2026-04-15');
  });

  it('月跨ぎでも 31 日前を計算する', () => {
    expect(getTaskLogsCutoffDate('2026-02-15')).toBe('2026-01-15');
  });

  it('年跨ぎでも 31 日前を計算する', () => {
    expect(getTaskLogsCutoffDate('2026-01-15')).toBe('2025-12-15');
  });
});

describe('setupSync', () => {
  beforeEach(() => {
    // fake-indexeddb (test-setup.ts で auto import 済み) を使って persist plugin を設定する
    configureSyncPersistence({ databaseName: 'habits-sync-test', tableNames: TABLE_NAMES });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('SupabaseClient を受け取って例外なく実行できる', async () => {
    const { state$ } = await import('./observables.js');
    // テストでは realtime: false でネットワーク接続を抑制し、from のみスタブする
    const fakeClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    } as unknown as SupabaseClient;

    expect(() =>
      setupSync(state$, fakeClient, { today: '2026-05-16', realtime: false }),
    ).not.toThrow();
  });

  it('state$.tasks / task_logs / time_slots / task_stash_view が Record として残る', async () => {
    const { state$ } = await import('./observables.js');
    const fakeClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    } as unknown as SupabaseClient;
    setupSync(state$, fakeClient, { today: '2026-05-16', realtime: false });

    expect(typeof state$.tasks.get()).toBe('object');
    expect(typeof state$.time_slots.get()).toBe('object');
    expect(typeof state$.task_logs.get()).toBe('object');
    expect(typeof state$.task_stash_view.get()).toBe('object');
  });
});
