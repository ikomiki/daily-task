import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const configureSyncPersistenceMock = vi.fn();
const setupSyncMock = vi.fn();
const startOnlineWatcherMock = vi.fn().mockReturnValue(() => {});

vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    configureSyncPersistence: (...args: unknown[]): unknown =>
      configureSyncPersistenceMock(...args),
    setupSync: (...args: unknown[]): unknown => setupSyncMock(...args),
    startOnlineWatcher: (...args: unknown[]): unknown => startOnlineWatcherMock(...args),
  };
});

vi.mock('../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({}),
}));

import { useSyncBootstrap } from './useSyncBootstrap.js';

describe('useSyncBootstrap', () => {
  beforeEach(() => {
    configureSyncPersistenceMock.mockReset();
    setupSyncMock.mockReset();
    startOnlineWatcherMock.mockReset();
    startOnlineWatcherMock.mockReturnValue(() => {});
  });

  it('マウント時に configureSyncPersistence と startOnlineWatcher を呼ぶ', () => {
    renderHook(() => useSyncBootstrap());
    expect(configureSyncPersistenceMock).toHaveBeenCalledTimes(1);
    expect(startOnlineWatcherMock).toHaveBeenCalledTimes(1);
  });

  it('マウント時に setupSync を呼ぶ（today を渡す）', () => {
    renderHook(() => useSyncBootstrap());
    expect(setupSyncMock).toHaveBeenCalledTimes(1);
    const call = setupSyncMock.mock.calls[0];
    expect(call[2]).toMatchObject({ today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it('unmount で startOnlineWatcher の cleanup が呼ばれる', () => {
    const cleanup = vi.fn();
    startOnlineWatcherMock.mockReturnValue(cleanup);
    const { unmount } = renderHook(() => useSyncBootstrap());
    unmount();
    expect(cleanup).toHaveBeenCalled();
  });
});
