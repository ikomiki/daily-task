import { observable, when } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { describe, expect, it } from 'vitest';
import { configureSyncPersistence } from './persist.js';

// fake-indexeddb 経由で IndexedDB が利用可能（test-setup.ts で auto import 済み）
describe('configureSyncPersistence', () => {
  it('configureSyncPersistence が ObservablePersistIndexedDB を global に登録する', () => {
    expect(() =>
      configureSyncPersistence({ databaseName: 'habits-test-1', tableNames: ['tasks'] }),
    ).not.toThrow();
  });

  it('永続化対象の observable は IndexedDB に保存されてリロード後も値が残る', async () => {
    // 1回目の "起動": plugin を設定して値を書き込む
    configureSyncPersistence({ databaseName: 'habits-test-2', tableNames: ['probe'] });
    const a$ = observable({ count: 0 });
    const aSync$ = syncObservable(a$, { persist: { name: 'probe' } });
    // isPersistLoaded になるまで待ってから値をセット
    await when(aSync$.isPersistLoaded);
    a$.count.set(42);

    // 書き込みが IndexedDB に反映されるまで待つ
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 2回目の "起動"（アプリ再起動）を模倣: 新しい plugin インスタンスで設定し直す
    // 新しいインスタンスは initialize() で IndexedDB から読み込むため値が復元される
    configureSyncPersistence({ databaseName: 'habits-test-2', tableNames: ['probe'] });
    const b$ = observable({ count: 0 });
    const bSync$ = syncObservable(b$, { persist: { name: 'probe' } });
    await when(bSync$.isPersistLoaded);
    expect(b$.count.get()).toBe(42);
  });
});
