import { defineConfig } from 'vitest/config';

// Node環境向けのvitest基本設定（純ロジック用）
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
