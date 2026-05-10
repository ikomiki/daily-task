import path from 'node:path';
import baseTest from '@org/config-vitest/react';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // jsdom 環境では実 Pixi をレンダリングしないため、テスト用スタブに差し替える。
      // 通常ビルドの vite では NODE_ENV !== 'test' で何もしない（条件分岐は test のみ）。
      ...(process.env.VITEST
        ? { '@pixi/react': path.resolve(__dirname, 'src/__mocks__/pixi-react.tsx') }
        : {}),
    },
  },
  test: baseTest.test,
});
