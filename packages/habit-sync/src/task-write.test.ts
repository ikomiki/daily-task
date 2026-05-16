import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { state$ } from './observables.js';
import { archiveTask, createTask, unarchiveTask, updateTask } from './task-write.js';

const fakeUser = { id: 'u1', email: 'a@b.co' } as unknown as User;

describe('createTask', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.tasks.set({});
  });

  it('uuid を発行して state$.tasks に行を追加する', () => {
    const id = createTask({
      name: '歯磨き',
      time_slot_id: 's1',
      frequency: { type: 'daily' },
      sort_order: 0,
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const row = state$.tasks.get()[id];
    expect(row?.name).toBe('歯磨き');
    expect(row?.time_slot_id).toBe('s1');
    expect(row?.user_id).toBe('u1');
    expect(row?.archived_at).toBeNull();
  });

  it('created_at / updated_at に ISO 文字列が入る', () => {
    const id = createTask({
      name: 'A',
      time_slot_id: 's1',
      frequency: { type: 'daily' },
      sort_order: 0,
    });
    const row = state$.tasks.get()[id];
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('user 未認証時は throw する', () => {
    state$.user.set(null);
    expect(() =>
      createTask({ name: 'X', time_slot_id: 's1', frequency: { type: 'daily' }, sort_order: 0 }),
    ).toThrow(/未認証/);
  });
});

describe('updateTask', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.tasks.set({
      t1: {
        id: 't1',
        user_id: 'u1',
        time_slot_id: 's1',
        name: '元の名前',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('name のみ更新できる', () => {
    updateTask('t1', { name: '新しい名前' });
    expect(state$.tasks.get().t1?.name).toBe('新しい名前');
    expect(state$.tasks.get().t1?.time_slot_id).toBe('s1');
  });

  it('frequency と time_slot_id も更新できる', () => {
    updateTask('t1', { frequency: { type: 'weekday', days: [1, 2, 3] }, time_slot_id: 's2' });
    const row = state$.tasks.get().t1;
    expect(row?.frequency).toEqual({ type: 'weekday', days: [1, 2, 3] });
    expect(row?.time_slot_id).toBe('s2');
  });

  it('updated_at が更新される', () => {
    updateTask('t1', { name: 'X' });
    expect(state$.tasks.get().t1?.updated_at).not.toBe('2026-01-01T00:00:00Z');
  });

  it('存在しない id は例外を投げない（no-op）', () => {
    expect(() => updateTask('not-exist', { name: 'X' })).not.toThrow();
  });
});

describe('archiveTask / unarchiveTask', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.tasks.set({
      t1: {
        id: 't1',
        user_id: 'u1',
        time_slot_id: 's1',
        name: 'A',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('archiveTask で archived_at に ISO 文字列が入る', () => {
    archiveTask('t1');
    const row = state$.tasks.get().t1;
    expect(row?.archived_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('unarchiveTask で archived_at が null に戻る', () => {
    archiveTask('t1');
    unarchiveTask('t1');
    expect(state$.tasks.get().t1?.archived_at).toBeNull();
  });
});
