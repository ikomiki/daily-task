import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureSyncPersistence } from './persist.js';
import { getTaskLogsCutoffDate, setupSync, stripPersistInjectedId } from './sync.js';

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
  beforeEach(async () => {
    // fake-indexeddb (test-setup.ts で auto import 済み) を使って persist plugin を設定する
    configureSyncPersistence({ databaseName: 'habits-sync-test', tableNames: TABLE_NAMES });
    // waitFor が state$.user を見て初回 GET / realtime subscribe を保留するため、
    // 各テストで認証済み相当のユーザを入れておく。
    const { state$ } = await import('./observables.js');
    state$.user.set({ id: 'u-test' } as never);
  });

  afterEach(async () => {
    const { state$ } = await import('./observables.js');
    state$.user.set(null);
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

  it('realtime: true のとき task_stash を購読する Channel を確立する', async () => {
    const { state$ } = await import('./observables.js');
    const subscribeSpy = vi.fn();
    const onSpy = vi.fn(() => ({ subscribe: subscribeSpy }));
    const channelSpy = vi.fn(() => ({ on: onSpy }));
    const fakeClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      channel: channelSpy,
    } as unknown as SupabaseClient;
    setupSync(state$, fakeClient, { today: '2026-05-16', realtime: true });

    expect(channelSpy).toHaveBeenCalledWith('task_stash_view_refresh');
    expect(onSpy).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ schema: 'public', table: 'task_stash' }),
      expect.any(Function),
    );
    expect(subscribeSpy).toHaveBeenCalled();
  });

  it('同じ client で setupSync を再実行しても task_stash チャンネルを重複生成しない', async () => {
    // React Strict Mode で useEffect が二重実行されると同一の SupabaseClient で
    // setupSync が複数回呼ばれる。同名 channel に subscribe 後 .on を再度呼ぶと
    // supabase-js が「cannot add postgres_changes callbacks after subscribe()」を投げるため、
    // クライアント単位で 1 回だけ購読が確立されることを保証する。
    const { state$ } = await import('./observables.js');
    const subscribeSpy = vi.fn();
    const onSpy = vi.fn(() => ({ subscribe: subscribeSpy }));
    const channelSpy = vi.fn(() => ({ on: onSpy }));
    const fakeClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      channel: channelSpy,
    } as unknown as SupabaseClient;

    setupSync(state$, fakeClient, { today: '2026-05-16', realtime: true });
    setupSync(state$, fakeClient, { today: '2026-05-16', realtime: true });

    expect(channelSpy).toHaveBeenCalledTimes(1);
    expect(onSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
  });

  it('state$.user が null の間は task_stash の Channel を確立しない（ログイン後に確立する）', async () => {
    const { state$ } = await import('./observables.js');
    state$.user.set(null);
    const subscribeSpy = vi.fn();
    const onSpy = vi.fn(() => ({ subscribe: subscribeSpy }));
    const channelSpy = vi.fn(() => ({ on: onSpy }));
    const fakeClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
      channel: channelSpy,
    } as unknown as SupabaseClient;

    setupSync(state$, fakeClient, { today: '2026-05-16', realtime: true });
    expect(channelSpy).not.toHaveBeenCalled();

    state$.user.set({ id: 'u-after-login' } as never);
    expect(channelSpy).toHaveBeenCalledWith('task_stash_view_refresh');
    expect(subscribeSpy).toHaveBeenCalled();
  });
});

describe('stripPersistInjectedId', () => {
  it('id プロパティが無ければそのまま返す', () => {
    const row = { task_id: 't1', date: '2026-05-16', status: 'complete' };
    expect(stripPersistInjectedId(row)).toEqual(row);
  });

  it('id プロパティだけを取り除いた新しいオブジェクトを返す', () => {
    const row = {
      task_id: 't1',
      date: '2026-05-16',
      status: 'complete',
      id: 't1-2026-05-16',
    };
    const result = stripPersistInjectedId(row);
    expect(result).toEqual({ task_id: 't1', date: '2026-05-16', status: 'complete' });
    expect('id' in result).toBe(false);
  });

  it('元オブジェクトを破壊しない（IndexedDB plugin がさらに副作用を起こさないよう）', () => {
    const row = {
      task_id: 't1',
      date: '2026-05-16',
      status: 'complete',
      id: 't1-2026-05-16',
    };
    stripPersistInjectedId(row);
    expect(row.id).toBe('t1-2026-05-16');
  });
});
