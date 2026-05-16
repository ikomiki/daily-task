import base from '@org/config-vitest/node';
import { mergeConfig } from 'vitest/config';

// habit-sync は IndexedDB を使うため fake-indexeddb をセットアップに追加する
export default mergeConfig(base, {
  test: {
    setupFiles: ['./src/test-setup.ts'],
  },
});
