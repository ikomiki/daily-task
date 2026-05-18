# @org/ui

habits アプリ用の React + Tailwind v4 共有 UI コンポーネント集。

依存できるのは `@org/habit-core`（型のみ）と `@org/config-*` のみ。`@org/habit-sync` には依存しない（状態は props で受け取る）。

## 開発

```bash
pnpm nx test @org/ui                  # vitest (jsdom + testing-library)
pnpm nx typecheck @org/ui
```

## コンポーネント一覧

| コンポーネント | 主な props | 説明 |
|---|---|---|
| `PageContainer` | `width?: 'normal' \| 'narrow'` | ページコンテンツを中央寄せ・パディング付きでラップする共通コンテナ |
| `PageHeader` | `title: string`, `nav?: ReactNode` | ページ上部の h1 タイトル + オプション nav スロット |
| `AlertText` | `tone?: 'error' \| 'warning'` | エラー（role="alert"）・警告（role="status"）メッセージ表示 |
| `Button` | `variant?: 'primary' \| 'secondary' \| 'destructive'`, `size?: 'sm' \| 'md'` | 汎用ボタン。HTML button 属性を透過的に受け取る |
| `TextInput` | `label: string`, `errorMessage?: string` | ラベル付きテキストインプット。バリデーションエラー表示対応 |
| `SelectInput` | `label: string`, `options: ReadonlyArray<{value, label}>` | ラベル付きセレクトインプット |
| `Card` | `className?: string` | ボーダー付きカードコンテナ |
| `AppNav` | `items`, `linkComponent`, `onSignOut?` | グローバルナビゲーション。`linkComponent` prop でルーター非依存 |

## デザイントークン

色とフォントは `@org/config-tailwind` の `theme.css` で定義。
個別のスタイルは Tailwind ユーティリティクラスで記述する。
