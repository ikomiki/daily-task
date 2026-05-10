# @org/ui

ゲーム共通の React + Tailwind v4 UI コンポーネント集。

依存できるのは `@org/audio` のみ。`@org/game-core` には依存しない（HUD は state を props で受け取る）。

## エクスポート

| API | 用途 |
|-----|------|
| `<ScoreHud score>` | 画面左上に固定するスコア表示。`role="status"`, `aria-label="Score"` |
| `./styles.css` | Tailwind v4 CSS（`@import 'tailwindcss'` + `@org/config-tailwind/theme.css`）|

## 利用例

```tsx
import { ScoreHud } from '@org/ui';
import '@org/ui/styles.css';

<ScoreHud score={42} />;
```

## 開発

```bash
pnpm nx test ui                  # vitest (jsdom + testing-library)
pnpm nx typecheck ui
```

## デザイントークン

色とフォントは `@org/config-tailwind` の `theme.css` で定義（`--color-game-bg`, `--color-game-fg`, `--color-game-accent`, `--font-display`）。
個別のスタイルは Tailwind ユーティリティクラスで記述する。
