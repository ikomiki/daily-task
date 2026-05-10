import { defineConfig, mergeConfig } from 'vitest/config';
import react from './react';

// Pixi利用テスト向け: jsdomにcanvasモックを足したい場合の拡張ポイント。
// 実際のレンダリングは別途e2eで担保し、ここは型/ロジック層のテストに留める。
export default mergeConfig(
  react,
  defineConfig({
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      // canvas を使うテストは server.deps.inline で .mjs 解決問題を避ける
      server: { deps: { inline: ['pixi.js'] } },
    },
  }),
);
