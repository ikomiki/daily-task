// task_logs の syncedSupabase に渡す create/update/delete カスタム関数を直接テストする。
// legend-state の write path（asyncキュー経由）に依存せず、プロパティレベルで検証する。
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureSyncPersistence } from './persist.js';

const TABLE_NAMES = ['time_slots', 'tasks', 'task_logs', 'task_stash_view'];

// syncedSupabase が受け取った props を記録するモック。
// vi.mock はファイル先頭に巻き上げられるため、capturedProps への参照で後から取り出す。
const capturedPropsList: Record<string, unknown>[] = [];
vi.mock('@legendapp/state/sync-plugins/supabase', () => ({
  syncedSupabase: vi.fn((props: Record<string, unknown>) => {
    capturedPropsList.push(props);
    // syncObservable が受け取れる最低限の値を返す
    return {};
  }),
}));

describe('setupSync — task_logs write props', () => {
  beforeEach(async () => {
    capturedPropsList.length = 0;
    configureSyncPersistence({ databaseName: 'habits-sync-test2', tableNames: TABLE_NAMES });
    const { state$ } = await import('./observables.js');
    state$.user.set({ id: 'u-test' } as never);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('task_logs の syncedSupabase props に create / update / delete が定義されている', async () => {
    const { setupSync } = await import('./sync.js');
    const { state$ } = await import('./observables.js');
    const fakeClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    } as unknown as SupabaseClient;

    setupSync(state$, fakeClient, { today: '2026-05-19', realtime: false });

    const taskLogsProps = capturedPropsList.find((p) => p.collection === 'task_logs');
    expect(taskLogsProps).toBeDefined();
    expect(typeof taskLogsProps?.create).toBe('function');
    expect(typeof taskLogsProps?.update).toBe('function');
    expect(typeof taskLogsProps?.delete).toBe('function');
  });

  it('create は onConflict:task_id,date 付きの upsert を呼ぶ', async () => {
    const { setupSync } = await import('./sync.js');
    const { state$ } = await import('./observables.js');
    const fakeClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    } as unknown as SupabaseClient;

    setupSync(state$, fakeClient, { today: '2026-05-19', realtime: false });

    const taskLogsProps = capturedPropsList.find((p) => p.collection === 'task_logs');
    const create = taskLogsProps?.create as (
      input: Record<string, unknown>,
    ) => ReturnType<ReturnType<ReturnType<SupabaseClient['from']>['upsert']>['select']>;

    const singleFn = vi.fn(() =>
      Promise.resolve({
        data: { task_id: 't1', date: '2026-05-19', status: 'complete' },
        error: null,
      }),
    );
    const selectSpy = vi.fn(() => ({ single: singleFn }));
    const upsertSpy = vi.fn(() => ({ select: selectSpy }));
    const fromSpy = vi.fn(() => ({ upsert: upsertSpy }));
    // create 関数内で typedClient.from(...).upsert(...) が呼ばれるよう、
    // fakeClient を差し替えた状態で create を直接呼べないため、
    // create 関数のコードを確認するには spy を埋め込んだ client で setupSync を再実行する。
    // ここでは capturedPropsList をリセットして spy 入り client で再セットアップする。
    capturedPropsList.length = 0;

    const spyClient = {
      from: fromSpy,
    } as unknown as SupabaseClient;

    setupSync(state$, spyClient, { today: '2026-05-19', realtime: false });

    const props2 = capturedPropsList.find((p) => p.collection === 'task_logs');
    const create2 = props2?.create as (input: Record<string, unknown>) => unknown;

    const input = { task_id: 't1', date: '2026-05-19', status: 'complete' };
    await create2(input);

    expect(upsertSpy).toHaveBeenCalledWith(input, { onConflict: 'task_id,date' });
  });

  it('update は onConflict:task_id,date 付きの upsert を呼ぶ', async () => {
    const { setupSync } = await import('./sync.js');
    const { state$ } = await import('./observables.js');

    const singleFn = vi.fn(() =>
      Promise.resolve({ data: { task_id: 't1', date: '2026-05-19', status: 'skip' }, error: null }),
    );
    const selectSpy = vi.fn(() => ({ single: singleFn }));
    const upsertSpy = vi.fn(() => ({ select: selectSpy }));
    const fromSpy = vi.fn(() => ({ upsert: upsertSpy }));
    const spyClient = { from: fromSpy } as unknown as SupabaseClient;

    setupSync(state$, spyClient, { today: '2026-05-19', realtime: false });

    const props = capturedPropsList.find((p) => p.collection === 'task_logs');
    const update = props?.update as (input: Record<string, unknown>) => unknown;

    const input = { task_id: 't1', date: '2026-05-19', status: 'skip' };
    await update(input);

    expect(upsertSpy).toHaveBeenCalledWith(input, { onConflict: 'task_id,date' });
  });

  it('delete は task_id と date の複合キーで絞り込む', async () => {
    const { setupSync } = await import('./sync.js');
    const { state$ } = await import('./observables.js');

    const singleFn = vi.fn(() => Promise.resolve({ data: null, error: null }));
    const eq2Spy = vi.fn(() => ({ select: vi.fn(() => ({ single: singleFn })) }));
    const eq1Spy = vi.fn(() => ({ eq: eq2Spy }));
    const deleteSpy = vi.fn(() => ({ eq: eq1Spy }));
    const fromSpy = vi.fn(() => ({ delete: deleteSpy }));
    const spyClient = { from: fromSpy } as unknown as SupabaseClient;

    setupSync(state$, spyClient, { today: '2026-05-19', realtime: false });

    const props = capturedPropsList.find((p) => p.collection === 'task_logs');
    const deleteFn = props?.delete as (input: Record<string, unknown>) => unknown;

    await deleteFn({ task_id: 't1', date: '2026-05-19', status: 'complete' });

    expect(deleteSpy).toHaveBeenCalled();
    expect(eq1Spy).toHaveBeenCalledWith('task_id', 't1');
    expect(eq2Spy).toHaveBeenCalledWith('date', '2026-05-19');
  });
});
