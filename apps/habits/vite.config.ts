import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'Habits',
        short_name: 'Habits',
        description: '毎日の習慣タスクを管理する',
        theme_color: '#0b0d12',
        background_color: '#0b0d12',
        display: 'standalone',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          {
            src: '/icon-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Supabase API レスポンスはキャッシュしない（同期は legend-state retry queue 任せ）
        navigateFallbackDenylist: [/^\/api/, /^\/auth\//],
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['@org/config-vitest/setup'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: { port: 5173 },
});
