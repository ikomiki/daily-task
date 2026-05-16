# @org/ui

habits アプリ用の React + Tailwind v4 共有 UI コンポーネント集。

> **移行期 (M1 時点):** 旧 `ScoreHud` / `@org/audio` 依存を削除した直後で、`src/index.ts` には `PACKAGE_NAME` のみ残る空パッケージ。habits アプリの実装が進む中で必要な共有コンポーネントが見えてきた段階でここに追加する。

依存できるのは `@org/habit-core`（型のみ）と `@org/config-*` のみ。`@org/habit-sync` には依存しない（状態は props で受け取る）。

## 開発

```bash
pnpm nx test @org/ui                  # vitest (jsdom + testing-library)
pnpm nx typecheck @org/ui
```

`vitest.config.ts` は `passWithNoTests: true` を一時的に有効にしている。実コンポーネントを追加した時点でこの設定を外す。

## デザイントークン

色とフォントは `@org/config-tailwind` の `theme.css` で定義。
個別のスタイルは Tailwind ユーティリティクラスで記述する。
