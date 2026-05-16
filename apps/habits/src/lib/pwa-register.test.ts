import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPwa } from './pwa-register.js';

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('registerPwa', () => {
  it('virtual:pwa-register が解決できない環境では例外を吐かずに完了する', async () => {
    // テスト環境では virtual:pwa-register は存在しないため、catch 経由で握り潰されることを確認
    await expect(registerPwa()).resolves.toBeUndefined();
  });

  it('複数回呼び出しても安全（idempotent: throw しない）', async () => {
    await expect(registerPwa()).resolves.toBeUndefined();
    await expect(registerPwa()).resolves.toBeUndefined();
  });
});
