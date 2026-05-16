import type { User } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getSupabaseClient,
  type NotificationProvider,
  resetSupabaseClient,
  type SupabaseConfig,
  state$,
} from './index.js';

const config: SupabaseConfig = {
  url: 'http://localhost:54321',
  anonKey: 'eyJ-dummy-anon-key-for-test',
};

describe('@org/habit-sync 公開 API スモーク', () => {
  afterEach(() => {
    resetSupabaseClient();
  });

  it('getSupabaseClient はシングルトンを返す', () => {
    const a = getSupabaseClient(config);
    const b = getSupabaseClient(config);
    expect(a).toBe(b);
  });

  it('resetSupabaseClient 後は新しいインスタンスになる', () => {
    const a = getSupabaseClient(config);
    resetSupabaseClient();
    const b = getSupabaseClient(config);
    expect(a).not.toBe(b);
  });

  it('state$ が legend-state observable として動作する', () => {
    expect(state$.user.get()).toBeNull();
    state$.user.set({ id: 'u1', email: 'a@b.co' } as unknown as User);
    expect(state$.user.get()?.id).toBe('u1');
    state$.user.set(null);
  });

  it('NotificationProvider インターフェースを実装できる', () => {
    const stub: NotificationProvider = {
      requestPermission: async () => 'granted',
      scheduleDaily: () => {},
      cancelAll: () => {},
    };
    expect(typeof stub.requestPermission).toBe('function');
  });
});
