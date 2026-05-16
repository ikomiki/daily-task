import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['@org/config-vitest/setup'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: { port: 5173 },
});
