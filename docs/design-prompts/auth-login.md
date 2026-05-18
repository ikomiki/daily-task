# ログイン（/auth/login）

## 目的

- メールアドレスとパスワードを受け取り、`signIn()` を呼び出してセッションを開始する
- 認証成功後に `/today` へリダイレクトし、デイリータスク画面へ誘導する
- 未認証ユーザーがアクセスできる唯一のエントリポイントの一つ（`/auth/signup` と対）
- クライアントサイドバリデーションでサーバーラウンドトリップを最小化する

## 表示要素

- `<section class="mx-auto max-w-md space-y-6 p-6">` でカード幅（max-w-md）にセンタリング
- `<h1 class="text-2xl font-bold text-game-accent">ログイン</h1>` — ページタイトル
- `AuthForm` コンポーネント（`features/auth/AuthForm.tsx`）: メールアドレス入力・パスワード入力・送信ボタン
  - 各入力は `<label>` でラップ、`border-gray-500 bg-transparent rounded` のスタイル
  - 送信ボタンは `bg-game-accent text-game-bg rounded w-full` — アクセントカラーで全幅
  - エラーメッセージは `<p role="alert" class="text-sm text-red-400">` で表示
- 新規登録へのリンク: `<Link to="/auth/signup" class="text-game-accent underline">`

## インタラクション

- フォーム送信時: クライアントバリデーション（メール形式・パスワード 6 文字以上）→ 失敗で `validationError` を表示
- バリデーション通過後: `isSubmitting = true` → `signIn()` 呼び出し → `isSubmitting = false`
- `signIn()` 失敗: `errorMessage` に Supabase のエラーを表示
- `signIn()` 成功: `useNavigate()` で `/today` へ遷移
- `isSubmitting` 中はボタンに `disabled:opacity-50` を適用しダブル送信を防止
- クライアントバリデーションエラーは次回送信ボタンを押したタイミングでリセット

## 状態

- **初期**: フォームが空、エラーなし
- **バリデーションエラー**: `validationError !== null` → `<p role="alert">` を表示
- **送信中（loading）**: `isSubmitting = true` → ボタン disabled・opacity-50
- **認証エラー**: `errorMessage !== null` — Supabase 由来のエラーメッセージを `<p role="alert">` に表示
- **成功**: `/today` へリダイレクト（UI は一瞬）

## レスポンシブ

- **〜640px**: `max-w-md` がフル幅に近い状態でセンタリング。`p-6` によりエッジに余白
- **〜1024px**: コンテナは `max-w-md (448px)` で中央寄せ。背景（`bg-game-bg`）が左右に広がる
- **1025px〜**: 同上。ログイン専用のシンプルなレイアウトで画面中央にフォームカードが浮く形

## アクセシビリティ

- メールアドレス input: `type="email"` + `autoComplete="email"` — ブラウザ補完・スクリーンリーダー向けセマンティクス
- パスワード input: `type="password"` + `autoComplete="current-password"`
- エラーメッセージは `role="alert"` — スクリーンリーダーが即座に読み上げる
- フォームは `noValidate` でブラウザ既定 UI を抑制し、独自エラー表示に統一
- 送信ボタンは `type="submit"` — Enter キーでもサブミット可能
- `<label>` でテキストとインプットが確実に紐付き、クリック領域が広がる
- コントラスト: `text-game-accent (#4cc9f0)` on `bg-game-bg (#0b0d12)` は WCAG AA 以上

## 既存スタイル参照

- `apps/habits/src/features/auth/Login.tsx` — ページコンテナ (`mx-auto max-w-md space-y-6 p-6`)、タイトル (`text-2xl font-bold text-game-accent`)
- `apps/habits/src/features/auth/AuthForm.tsx` — フォームフィールド (`rounded border border-gray-500 bg-transparent px-3 py-2`)、送信ボタン (`w-full rounded bg-game-accent px-4 py-2 font-medium text-game-bg disabled:opacity-50`)、エラー (`text-sm text-red-400`)
- `packages/config-tailwind/src/theme.css` — `--color-game-accent: #4cc9f0`, `--color-game-bg: #0b0d12`, `--color-game-fg: #e6e8ef`
- M14: `PageContainer width="narrow"` + ブランドマーク（habits. ロゴ）。
