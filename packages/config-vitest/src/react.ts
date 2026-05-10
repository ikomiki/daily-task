import { defineConfig } from 'vitest/config';

// React (jsdom + testing-library) 向けのvitest基本設定
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['@org/config-vitest/setup'],
  },
});
