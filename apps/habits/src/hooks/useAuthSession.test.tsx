import { state$ } from '@org/habit-sync';
import type { Session } from '@supabase/supabase-js';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthSession } from './useAuthSession.js';

const getCurrentSessionMock = vi.fn();
const subscribeAuthStateMock = vi.fn();
vi.mock('../lib/auth.js', () => ({
  getCurrentSession: (...args: unknown[]): unknown => getCurrentSessionMock(...args),
  subscribeAuthState: (...args: unknown[]): unknown => subscribeAuthStateMock(...args),
}));
vi.mock('../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({}),
}));

describe('useAuthSession', () => {
  beforeEach(() => {
    state$.user.set(null);
    getCurrentSessionMock.mockReset();
    subscribeAuthStateMock.mockReset();
    subscribeAuthStateMock.mockReturnValue(() => {});
  });

  it('マウント時に getCurrentSession を呼んで state$.user に反映する', async () => {
    const session: Session = { user: { id: 'u1', email: 'a@b.co' }, access_token: 'x' } as Session;
    getCurrentSessionMock.mockResolvedValue(session);
    renderHook(() => useAuthSession());
    await vi.waitFor(() => {
      expect(state$.user.get()?.id).toBe('u1');
    });
  });

  it('subscribeAuthState のコールバックで state$.user を更新する', () => {
    let listener: ((event: string, session: Session | null) => void) | null = null;
    subscribeAuthStateMock.mockImplementation((_client, l) => {
      listener = l;
      return () => {};
    });
    getCurrentSessionMock.mockResolvedValue(null);
    renderHook(() => useAuthSession());
    expect(listener).not.toBeNull();
    listener?.('SIGNED_IN', { user: { id: 'u2', email: 'c@d.co' }, access_token: 'y' } as Session);
    expect(state$.user.get()?.id).toBe('u2');
    listener?.('SIGNED_OUT', null);
    expect(state$.user.get()).toBeNull();
  });

  it('unmount で unsubscribe される', () => {
    const unsub = vi.fn();
    subscribeAuthStateMock.mockReturnValue(unsub);
    getCurrentSessionMock.mockResolvedValue(null);
    const { unmount } = renderHook(() => useAuthSession());
    unmount();
    expect(unsub).toHaveBeenCalled();
  });
});
