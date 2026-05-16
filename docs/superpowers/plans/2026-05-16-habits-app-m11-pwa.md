# Habits App M11: PWA 化 (vite-plugin-pwa + SW + マニフェスト) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** habits アプリを PWA としてインストール可能にする。`vite-plugin-pwa`（Workbox 内蔵）を vite に組み込んで `manifest.webmanifest` と Service Worker を自動生成し、アプリシェル（HTML/JS/CSS/アイコン）をプリキャッシュ。ユーザーが「ホーム画面に追加」できる状態を満たし、Lighthouse PWA installable をグリーンにする。

**Architecture:** `apps/habits/vite.config.ts` に `VitePWA({ registerType: 'autoUpdate', manifest, workbox })` を追加。`apps/habits/public/` に SVG ベースのアイコン 3 種（192 / 512 / maskable）を配置。`apps/habits/index.html` に `theme-color` / `description` / `apple-touch-icon` のメタタグを追加。`apps/habits/src/lib/pwa-register.ts` で `virtual:pwa-register` を動的 import する薄いラッパーを書き、`main.tsx` から呼び出す。`virtual:pwa-register` は Vite ビルド時にのみ実体化されるため、vitest 環境では import 失敗を握り潰す。

**Tech Stack:** vite-plugin-pwa 1.3 (catalog), Workbox (plugin 内蔵), SVG icons, vite 7

---

## ファイル構成

新規作成:

| パス | 責務 |
|---|---|
| `apps/habits/public/icon-192.svg` | 192×192 PWA アイコン |
| `apps/habits/public/icon-512.svg` | 512×512 PWA アイコン |
| `apps/habits/public/icon-maskable.svg` | maskable purpose 用（セーフエリア確保） |
| `apps/habits/public/favicon.svg` | ブラウザタブ用 favicon |
| `apps/habits/src/lib/pwa-register.ts` | `virtual:pwa-register` の薄い動的 import ラッパー |
| `apps/habits/src/lib/pwa-register.test.ts` | 上記ラッパーのテスト |
| `apps/habits/src/types/pwa-register.d.ts` | `virtual:pwa-register` モジュール型宣言（vite-plugin-pwa/client を tsconfig に積めない場合の保険） |
| `apps/habits/src/pwa-assets.test.ts` | アイコン / vite.config / index.html / manifest の整合性スモークテスト |

修正:

| パス | 修正内容 |
|---|---|
| `apps/habits/vite.config.ts` | `VitePWA(...)` plugin を `plugins` に追加 |
| `apps/habits/index.html` | `theme-color` / `description` / `apple-touch-icon` / favicon link 追加 |
| `apps/habits/src/main.tsx` | `registerPwa()` を呼び出し |
| `apps/habits/tsconfig.app.json` | `types` に `vite-plugin-pwa/client` を追加 |
| `CLAUDE.md` | 「PWA 化（M11 以降）」セクション追加 |

スコープ外（将来拡張）:

- Web Push 通知（v1.5 で Service Worker + Edge Function + pg_cron）
- カスタム Service Worker（injectManifest 戦略）でのオフライン強化
- PWA インストールプロンプト UI（`beforeinstallprompt` イベント）
- スプラッシュスクリーン / iOS スプラッシュ画像
- バックグラウンド同期（Background Sync API）

ビルド成果物（参考）:

```
apps/habits/dist/
  index.html                 ← manifest link, icon link 自動挿入
  manifest.webmanifest       ← VitePWA 自動生成
  sw.js                      ← Workbox 自動生成
  registerSW.js              ← 自動登録スクリプト
  assets/...                 ← prebuilt JS/CSS
  icon-192.svg / icon-512.svg / icon-maskable.svg / favicon.svg
```

---

## Task 1: PWA アイコン作成

**Files:**
- Create: `apps/habits/public/icon-192.svg`
- Create: `apps/habits/public/icon-512.svg`
- Create: `apps/habits/public/icon-maskable.svg`
- Create: `apps/habits/public/favicon.svg`

シンプルな「H」モノグラム + アクセントカラー背景の SVG を作る。テーマは `config-tailwind/theme.css` の `--color-game-accent` 由来の色を使う（実色は配色トークンを参照、無ければ `#22d3ee` cyan 系のデフォルト）。

- [ ] **Step 1: 192×192 アイコン**

`apps/habits/public/icon-192.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <rect width="192" height="192" rx="32" fill="#0f172a"/>
  <text x="96" y="118" font-family="system-ui, -apple-system, sans-serif" font-size="120" font-weight="800" text-anchor="middle" fill="#22d3ee">H</text>
</svg>
```

- [ ] **Step 2: 512×512 アイコン**

`apps/habits/public/icon-512.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="80" fill="#0f172a"/>
  <text x="256" y="320" font-family="system-ui, -apple-system, sans-serif" font-size="320" font-weight="800" text-anchor="middle" fill="#22d3ee">H</text>
</svg>
```

- [ ] **Step 3: maskable アイコン（セーフエリア確保）**

maskable 用は中心 80% に重要なコンテンツを収める必要がある。背景は全面 fill、文字を小さめに:

`apps/habits/public/icon-maskable.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#0f172a"/>
  <text x="256" y="296" font-family="system-ui, -apple-system, sans-serif" font-size="240" font-weight="800" text-anchor="middle" fill="#22d3ee">H</text>
</svg>
```

- [ ] **Step 4: favicon**

`apps/habits/public/favicon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="6" fill="#0f172a"/>
  <text x="16" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" text-anchor="middle" fill="#22d3ee">H</text>
</svg>
```

- [ ] **Step 5: 配置確認 & コミット**

```bash
ls apps/habits/public/icon-192.svg apps/habits/public/icon-512.svg apps/habits/public/icon-maskable.svg apps/habits/public/favicon.svg
cd /Users/ikomiki/workspace/daily-task && git add apps/habits/public/icon-192.svg apps/habits/public/icon-512.svg apps/habits/public/icon-maskable.svg apps/habits/public/favicon.svg && git commit -m "feat(habits): add PWA icons (192/512/maskable/favicon SVGs)"
```

---

## Task 2: vite.config.ts に VitePWA plugin を追加

**Files:**
- Modify: `apps/habits/vite.config.ts`

`registerType: 'autoUpdate'` で更新検知時に自動で SW を入れ替える戦略。`devOptions.enabled = false` で開発ビルドでは SW を作らない（hot reload の挙動を素直に保つ）。

- [ ] **Step 1: vite.config.ts を更新**

`apps/habits/vite.config.ts` を以下の完全な内容で置き換え:

```ts
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
        theme_color: '#0f172a',
        background_color: '#0f172a',
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
```

- [ ] **Step 2: 型チェック**

```bash
cd /Users/ikomiki/workspace/daily-task && CI=true pnpm nx typecheck habits
```

Expected: PASS

注意: `vite-plugin-pwa` の型が解決できない場合は、`pnpm install` を再実行（catalog 経由で 1.3.0 が既に入っているはず）。

- [ ] **Step 3: ビルド成功を確認**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm nx build habits
ls apps/habits/dist/manifest.webmanifest apps/habits/dist/sw.js apps/habits/dist/registerSW.js 2>&1
```

Expected:
- ビルド成功（warning は許容）
- `dist/manifest.webmanifest` / `dist/sw.js` / `dist/registerSW.js` が存在

- [ ] **Step 4: コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/vite.config.ts && git add apps/habits/vite.config.ts && git commit -m "feat(habits): wire VitePWA plugin (autoUpdate, manifest, workbox precache)"
```

---

## Task 3: index.html に PWA メタタグを追加

**Files:**
- Modify: `apps/habits/index.html`

`vite-plugin-pwa` が manifest link tag を自動注入するが、`theme-color` や `apple-touch-icon` 等は手書きで追加する。

- [ ] **Step 1: index.html を更新**

`apps/habits/index.html` を以下の完全な内容で置き換え:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0f172a" />
    <meta name="description" content="毎日の習慣タスクを管理する Habits アプリ" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Habits" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/icon-192.svg" />
    <title>Habits</title>
  </head>
  <body class="bg-game-bg text-game-fg">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: ビルド時の出力確認**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm nx build habits
grep -E "(manifest|theme-color|apple-touch)" apps/habits/dist/index.html
```

Expected: `<link rel="manifest" .../>` が VitePWA により注入され、`theme-color` も保持されている

- [ ] **Step 3: コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && git add apps/habits/index.html && git commit -m "feat(habits): add PWA meta tags (theme-color, apple-touch, manifest hooks)"
```

---

## Task 4: pwa-register ラッパー + main.tsx 統合

**Files:**
- Create: `apps/habits/src/lib/pwa-register.ts`
- Test: `apps/habits/src/lib/pwa-register.test.ts`
- Create: `apps/habits/src/types/pwa-register.d.ts`
- Modify: `apps/habits/src/main.tsx`

`virtual:pwa-register` は Vite ビルド時にのみ実体化されるため、vitest 環境では存在しない。動的 import を try/catch で握り潰す形にして、テスト環境では skip パスを通せるようにする。

- [ ] **Step 1: 型宣言ファイル**

`apps/habits/src/types/pwa-register.d.ts`:

```ts
// vite-plugin-pwa が build 時に注入する virtual モジュールの型宣言。
// tsconfig.app.json の types で vite-plugin-pwa/client を取り込めば不要だが、
// 失敗時の保険として明示しておく。
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
```

- [ ] **Step 2: 失敗するテストを作成**

`apps/habits/src/lib/pwa-register.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPwa } from './pwa-register.js';

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('registerPwa', () => {
  it('virtual:pwa-register が解決できない環境では例外を吐かずに完了する', async () => {
    // テスト環境では virtual:pwa-register は存在しないため、catch 経由で握り潰されることを確認
    await expect(registerPwa()).resolves.toBeUndefined();
  });

  it('複数回呼び出しても安全（idempotent: throw しない）', async () => {
    await expect(registerPwa()).resolves.toBeUndefined();
    await expect(registerPwa()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: テスト失敗を確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/lib/pwa-register.test.ts
```

Expected: FAIL（モジュール未作成）

- [ ] **Step 4: 実装**

`apps/habits/src/lib/pwa-register.ts`:

```ts
// vite-plugin-pwa が build 時に注入する virtual:pwa-register を動的 import する薄いラッパー。
// vitest 環境では virtual モジュールが存在せず import が throw するため、catch 経由で握り潰す。
// 本番ビルドでは autoUpdate モード相当（immediate=true）で SW を登録する。
export async function registerPwa(): Promise<void> {
  try {
    const mod = await import('virtual:pwa-register');
    mod.registerSW({
      immediate: true,
      onRegisterError: (err) => {
        console.warn('[pwa] SW 登録失敗:', err);
      },
    });
  } catch (err) {
    // dev / test 環境では virtual:pwa-register が解決できない → 握り潰す
    console.debug('[pwa] virtual:pwa-register をスキップ:', err);
  }
}
```

- [ ] **Step 5: テスト pass 確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/lib/pwa-register.test.ts
```

Expected: 2 件 PASS

- [ ] **Step 6: main.tsx を更新**

`apps/habits/src/main.tsx` を以下の完全な内容で置き換え:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import { registerPwa } from './lib/pwa-register.js';
import './styles.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('#root が index.html に見つかりません');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA Service Worker 登録（vitest 環境では握り潰される）
void registerPwa();
```

- [ ] **Step 7: 全 habits テスト + 型チェック**

```bash
cd /Users/ikomiki/workspace/daily-task && CI=true pnpm nx typecheck test habits
```

Expected: 全 PASS

- [ ] **Step 8: Biome + コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/lib/pwa-register.ts apps/habits/src/lib/pwa-register.test.ts apps/habits/src/types/pwa-register.d.ts apps/habits/src/main.tsx
git add apps/habits/src/lib/pwa-register.ts apps/habits/src/lib/pwa-register.test.ts apps/habits/src/types/pwa-register.d.ts apps/habits/src/main.tsx
git commit -m "feat(habits): add registerPwa wrapper and wire it from main.tsx"
```

---

## Task 5: tsconfig.app.json に vite-plugin-pwa/client を追加

**Files:**
- Modify: `apps/habits/tsconfig.app.json`

- [ ] **Step 1: tsconfig.app.json を更新**

`apps/habits/tsconfig.app.json` を以下の完全な内容で置き換え:

```json
{
  "extends": "@org/config-tsconfig/app.json",
  "compilerOptions": {
    "types": ["vite/client", "vite-plugin-pwa/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"]
}
```

- [ ] **Step 2: 型チェック**

```bash
cd /Users/ikomiki/workspace/daily-task && CI=true pnpm nx typecheck habits
```

Expected: PASS

- [ ] **Step 3: コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && git add apps/habits/tsconfig.app.json && git commit -m "build(habits): include vite-plugin-pwa/client types in tsconfig.app.json"
```

---

## Task 6: PWA 整合性スモークテスト

**Files:**
- Create: `apps/habits/src/pwa-assets.test.ts`

ビルド成果物検証は手動 / E2E に任せ、ここではリポジトリ内のソース整合性のみ静的に確認する（ファイル存在 + vite.config / index.html の必須キー）。

- [ ] **Step 1: テストを作成**

`apps/habits/src/pwa-assets.test.ts`:

```ts
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
});
```

- [ ] **Step 2: テスト pass 確認**

```bash
cd /Users/ikomiki/workspace/daily-task/apps/habits && pnpm exec vitest run src/pwa-assets.test.ts
```

Expected: PASS（10 件: 4 + 1 + 1 + 1 + 1 + 1 + 1）

- [ ] **Step 3: Biome + コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm exec biome ci apps/habits/src/pwa-assets.test.ts && git add apps/habits/src/pwa-assets.test.ts && git commit -m "test(habits): add PWA assets smoke tests"
```

---

## Task 7: CLAUDE.md に M11 セクション + ビルド最終検証

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md を更新**

`### 通知 v1 / フォアグラウンドスケジューラ（M10 以降）` セクション直後、`## E2E（Playwright）` 見出しの直前に挿入:

```markdown
### PWA 化 / Service Worker（M11 以降）

- `vite-plugin-pwa` (catalog: ^1.0.0) を `apps/habits/vite.config.ts` で有効化、Workbox ベースで SW + manifest を自動生成
- `registerType: 'autoUpdate'` — 新バージョン検知で自動更新（リフレッシュ不要）
- マニフェスト: `name: Habits`, `display: standalone`, `theme_color: #0f172a`, `lang: ja`
- アイコン: `apps/habits/public/{icon-192,icon-512,icon-maskable,favicon}.svg`（SVG 統一、iOS は apple-touch-icon を `icon-192.svg` で参照）
- `apps/habits/src/lib/pwa-register.ts` が `virtual:pwa-register` を動的 import するラッパー（vitest 環境では catch で握り潰される）
- ビルド成果物: `dist/manifest.webmanifest` / `dist/sw.js` / `dist/registerSW.js`
- `workbox.globPatterns` で JS/CSS/HTML/SVG/woff2 をプリキャッシュ、`navigateFallbackDenylist` で `/api` と `/auth` を除外
- `devOptions.enabled = false` — 開発ビルドでは SW を出さない（HMR 阻害回避）
- スコープ外: Web Push（v1.5）、カスタム SW (injectManifest)、インストールプロンプト UI、スプラッシュ画像
```

- [ ] **Step 2: ビルド最終検証**

```bash
cd /Users/ikomiki/workspace/daily-task && pnpm nx build habits
ls -la apps/habits/dist/manifest.webmanifest apps/habits/dist/sw.js apps/habits/dist/registerSW.js
cat apps/habits/dist/manifest.webmanifest | head -20
```

Expected:
- ビルド成功
- 3 ファイルが存在
- manifest.webmanifest が JSON で `"name":"Habits"` を含む

- [ ] **Step 3: 完了検証 — 全体テスト**

```bash
cd /Users/ikomiki/workspace/daily-task && CI=true pnpm nx run-many -t typecheck test --skip-nx-cache
```

Expected: 全 5 プロジェクト緑

- [ ] **Step 4: Biome 全体**

```bash
pnpm exec biome ci .
```

Expected: clean

- [ ] **Step 5: コミット**

```bash
cd /Users/ikomiki/workspace/daily-task && git add CLAUDE.md && git commit -m "docs: document M11 PWA section in CLAUDE.md"
```

---

## 完了検証

すべてのタスク完了後の最終チェック:

- [ ] **typecheck / test 全件**

```bash
cd /Users/ikomiki/workspace/daily-task
CI=true pnpm nx run-many -t typecheck test --skip-nx-cache
```

Expected: 全 5 プロジェクト緑、合計 ~378 件 PASS（M11 で 12 件追加: 2 + 10）

- [ ] **biome ci**

```bash
pnpm exec biome ci .
```

Expected: clean

- [ ] **手動確認**

```bash
pnpm nx build habits
pnpm nx serve habits
```

ブラウザで:

1. `http://localhost:5173/` で起動 → DevTools の Application タブ
2. Manifest セクション: name=Habits, display=standalone, icons 3 種が認識される
3. Service Workers セクション: `sw.js` が registered, active 状態
4. Lighthouse の PWA カテゴリで Installable: PASS
5. アドレスバーまたは Chrome メニューに「インストール」ボタンが出現
6. インストール後、スタンドアロンウィンドウで開かれること

---

## スコープ外（将来拡張）

- **Web Push 通知**: Service Worker + Web Push API + Supabase Edge Function + pg_cron。タブを閉じても通知が出る形にリプレース（M10 の WebNotificationProvider と TauriNotificationProvider に加えて WebPushNotificationProvider）
- **カスタム Service Worker**（injectManifest）: 細かな fetch 戦略・background sync・push 受信ハンドラを書く。現状は generateSW で十分
- **インストールプロンプト UI**: `beforeinstallprompt` イベントをフックして「インストール」ボタンを App 内に出す
- **iOS スプラッシュスクリーン**: `apple-mobile-web-app-status-bar-style` 以上の体験を作る場合、ランチャー画像をサイズ毎に生成
- **Background Sync API**: legend-state の retry queue を SW 側にもオフロードしてアプリ未起動時にも同期
- **Update notification UI**: `onNeedRefresh` を toast UI に繋げて「新バージョンが利用可能」通知（現状は autoUpdate で透過更新）
