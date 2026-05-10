import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import baseTest from '@org/config-vitest/react';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: baseTest.test,
});
