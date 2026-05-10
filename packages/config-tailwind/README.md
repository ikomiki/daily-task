# @org/config-tailwind

ワークスペース共通の Tailwind CSS v4 テーマ。

Tailwind v4 は CSS-first 設計のため、JS preset ではなく `@theme` ブロックを CSS で配布する。

## 提供するトークン

`src/theme.css`:

```css
@theme {
  --color-game-bg: #0b0d12;
  --color-game-fg: #e6e8ef;
  --color-game-accent: #4cc9f0;
  --font-display: "Inter", "Hiragino Sans", sans-serif;
}
```

これらは Tailwind の自動生成ユーティリティで `bg-game-bg`, `text-game-fg`, `text-game-accent`, `font-display` のように使える。

## 使い方

各 app/lib の `styles.css`:

```css
@import "tailwindcss";
@import "@org/config-tailwind/theme.css";
```

Vite アプリでは `vite.config.ts` で `@tailwindcss/vite` プラグインを有効化する。
