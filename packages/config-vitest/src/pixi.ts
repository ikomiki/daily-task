import { defineConfig } from 'vitest/config';

// Pixi利用テスト向け: jsdom + testing-library + pixi.js inline 化。
// 実際のレンダリングはe2eで担保し、ここは型/ロジック層のテストに留める。
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['@org/config-vitest/setup'],
    server: { deps: { inline: ['pixi.js'] } },
  },
});
