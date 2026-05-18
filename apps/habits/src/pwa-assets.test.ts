import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_ROOT = resolve(__dirname, '..');

describe('PWA assets', () => {
  it.each([
    'icon-192.svg',
    'icon-512.svg',
    'icon-maskable.svg',
    'favicon.svg',
  ])('public/%s が存在する', (file) => {
    expect(existsSync(resolve(APP_ROOT, 'public', file))).toBe(true);
  });

  it('vite.config.ts に VitePWA( の呼び出しが含まれる', () => {
    const content = readFileSync(resolve(APP_ROOT, 'vite.config.ts'), 'utf8');
    expect(content).toMatch(/VitePWA\(/);
  });

  it('vite.config.ts に icon-192 / 512 / maskable の参照が含まれる', () => {
    const content = readFileSync(resolve(APP_ROOT, 'vite.config.ts'), 'utf8');
    expect(content).toContain('/icon-192.svg');
    expect(content).toContain('/icon-512.svg');
    expect(content).toContain('/icon-maskable.svg');
  });

  it('vite.config.ts の manifest に display: standalone が含まれる', () => {
    const content = readFileSync(resolve(APP_ROOT, 'vite.config.ts'), 'utf8');
    expect(content).toMatch(/display:\s*'standalone'/);
  });

  it('index.html に theme-color meta が含まれる', () => {
    const content = readFileSync(resolve(APP_ROOT, 'index.html'), 'utf8');
    expect(content).toMatch(/<meta name="theme-color"/);
  });

  it('index.html に apple-touch-icon link が含まれる', () => {
    const content = readFileSync(resolve(APP_ROOT, 'index.html'), 'utf8');
    expect(content).toMatch(/<link[^>]+rel="apple-touch-icon"/);
  });

  it('index.html に favicon link が含まれる', () => {
    const content = readFileSync(resolve(APP_ROOT, 'index.html'), 'utf8');
    expect(content).toMatch(/<link[^>]+rel="icon"[^>]+href="\/favicon\.svg"/);
  });

  it('vite.config.ts の manifest theme_color が --color-game-bg トークンと一致する', () => {
    const content = readFileSync(resolve(APP_ROOT, 'vite.config.ts'), 'utf8');
    expect(content).toContain("theme_color: '#0b0d12'");
    expect(content).toContain("background_color: '#0b0d12'");
  });

  it('index.html の theme-color meta が --color-game-bg トークンと一致する', () => {
    const content = readFileSync(resolve(APP_ROOT, 'index.html'), 'utf8');
    expect(content).toMatch(/name="theme-color"[^>]*content="#0b0d12"/);
  });
});
