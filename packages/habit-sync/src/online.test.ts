import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 各テスト前にモジュール状態をリセットするため、dynamic import で取得する
type OnlineModule = typeof import('./online.js');

describe('online$ observable', () => {
  let listeners: Map<string, EventListener>;

  beforeEach(() => {
    listeners = new Map();
    // window と navigator を最小限スタブ
    vi.stubGlobal('window', {
      addEventListener: (type: string, cb: EventListener) => listeners.set(type, cb),
      removeEventListener: (type: string) => listeners.delete(type),
    });
    vi.stubGlobal('navigator', { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('初期値は navigator.onLine に従う (true)', async () => {
    const { online$, startOnlineWatcher } = (await import('./online.js')) as OnlineModule;
    startOnlineWatcher();
    expect(online$.get()).toBe(true);
  });

  it('初期値が navigator.onLine=false なら false', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { online$, startOnlineWatcher } = (await import('./online.js')) as OnlineModule;
    startOnlineWatcher();
    expect(online$.get()).toBe(false);
  });

  it('offline イベントで online$ が false になる', async () => {
    const { online$, startOnlineWatcher } = (await import('./online.js')) as OnlineModule;
    startOnlineWatcher();
    expect(online$.get()).toBe(true);
    listeners.get('offline')?.(new Event('offline'));
    expect(online$.get()).toBe(false);
  });

  it('online イベントで online$ が true になる', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { online$, startOnlineWatcher } = (await import('./online.js')) as OnlineModule;
    startOnlineWatcher();
    expect(online$.get()).toBe(false);
    listeners.get('online')?.(new Event('online'));
    expect(online$.get()).toBe(true);
  });

  it('startOnlineWatcher は unsubscribe 関数を返し、呼ぶと listener が解除される', async () => {
    const { startOnlineWatcher } = (await import('./online.js')) as OnlineModule;
    const stop = startOnlineWatcher();
    expect(listeners.size).toBeGreaterThan(0);
    stop();
    expect(listeners.size).toBe(0);
  });
});
