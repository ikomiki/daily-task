import { describe, expect, it } from 'vitest';
import { createScoreStore } from './score';

describe('createScoreStore', () => {
  it('初期スコアは0', () => {
    const store = createScoreStore();
    expect(store.getState().score).toBe(0);
  });

  it('increment で +1 される', () => {
    const store = createScoreStore();
    store.getState().increment();
    expect(store.getState().score).toBe(1);
  });

  it('reset で 0 に戻る', () => {
    const store = createScoreStore();
    store.getState().increment();
    store.getState().increment();
    store.getState().reset();
    expect(store.getState().score).toBe(0);
  });
});
