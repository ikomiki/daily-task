import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { state$ } from './observables.js';
import { createTimeSlot, deleteTimeSlot, updateTimeSlot } from './time-slot-write.js';

const fakeUser = { id: 'u1', email: 'a@b.co' } as unknown as User;

describe('createTimeSlot', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.time_slots.set({});
  });

  it('uuid を発行して state$.time_slots に行を追加する', () => {
    const id = createTimeSlot({ name: '朝', notify_at: '07:00:00', sort_order: 0 });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const row = state$.time_slots.get()[id];
    expect(row?.name).toBe('朝');
    expect(row?.notify_at).toBe('07:00:00');
    expect(row?.user_id).toBe('u1');
  });

  it('user 未認証時は throw する', () => {
    state$.user.set(null);
    expect(() => createTimeSlot({ name: 'X', notify_at: '08:00:00', sort_order: 0 })).toThrow(
      /未認証/,
    );
  });
});

describe('updateTimeSlot', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.time_slots.set({
      s1: {
        id: 's1',
        user_id: 'u1',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('name と notify_at を更新できる', () => {
    updateTimeSlot('s1', { name: '早朝', notify_at: '05:30:00' });
    const row = state$.time_slots.get().s1;
    expect(row?.name).toBe('早朝');
    expect(row?.notify_at).toBe('05:30:00');
  });

  it('存在しない id は no-op', () => {
    expect(() => updateTimeSlot('not-exist', { name: 'X' })).not.toThrow();
  });
});

describe('deleteTimeSlot', () => {
  beforeEach(() => {
    state$.user.set(fakeUser);
    state$.time_slots.set({
      s1: {
        id: 's1',
        user_id: 'u1',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      s2: {
        id: 's2',
        user_id: 'u1',
        name: '夜',
        notify_at: '21:00:00',
        sort_order: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    state$.tasks.set({});
  });

  it('参照タスクが無く 2 件以上残る場合は削除成功', () => {
    const result = deleteTimeSlot('s1');
    expect(result).toEqual({ ok: true });
    expect(state$.time_slots.get().s1).toBeUndefined();
    expect(state$.time_slots.get().s2).toBeDefined();
  });

  it('最後の 1 件は削除不可', () => {
    deleteTimeSlot('s1');
    const result = deleteTimeSlot('s2');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/最低 1 個/);
    }
    expect(state$.time_slots.get().s2).toBeDefined();
  });

  it('アクティブタスクが参照している場合は削除不可', () => {
    state$.tasks.set({
      t1: {
        id: 't1',
        user_id: 'u1',
        time_slot_id: 's1',
        name: '歯磨き',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    const result = deleteTimeSlot('s1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/タスク/);
    }
    expect(state$.time_slots.get().s1).toBeDefined();
  });

  it('アーカイブ済タスクのみ参照している場合も削除不可', () => {
    state$.tasks.set({
      t1: {
        id: 't1',
        user_id: 'u1',
        time_slot_id: 's1',
        name: '歯磨き',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: '2026-05-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    const result = deleteTimeSlot('s1');
    expect(result.ok).toBe(false);
  });
});
