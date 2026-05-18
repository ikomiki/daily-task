# 新規登録（/auth/signup）

## 目的

- メールアドレスとパスワードを受け取り、`signUp()` を呼び出して新規アカウントを作成する
- 登録成功後に `/today` へリダイレクトし、ハビット管理を即座に開始できるようにする
- 開発環境ではメール確認不要（`auth.users` INSERT トリガーで初期データが自動生成される）
- パスワードは `autoComplete="new-password"` でパスワードマネージャーによる生成を促す

## 表示要素

- `<section class="mx-auto max-w-md space-y-6 p-6">` — ログイン画面と同一レイアウト
- `<h1 class="text-2xl font-bold text-game-accent">新規登録</h1>` — ページタイトル
- `AuthForm` コンポーネント（`features/auth/AuthForm.tsx`）: メールアドレス入力・パスワード入力・「新規登録」ボタン
  - `passwordAutoComplete="new-password"` を渡してパスワードマネージャー生成を促す
  - エラーメッセージは `<p role="alert" class="text-sm text-red-400">`
  - 送信ボタン: `bg-game-accent text-game-bg w-full`
- ログインへのリンク: `<Link to="/auth/login" class="text-game-accent underline">`

## インタラクション

- フォーム送信時: クライアントバリデーション（メール形式・パスワード 6 文字以上）→ 失敗でエラー表示
- バリデーション通過後: `isSubmitting = true` → `signUp()` 呼び出し → `isSubmitting = false`
- `signUp()` 失敗: Supabase エラー（メール重複など）を `errorMessage` に格納し `<p role="alert">` で表示
- `signUp()` 成功: `useNavigate()` で `/today` へ遷移（初期データはトリガー側で自動投入）
- `isSubmitting` 中はボタン disabled で二重送信を防止

## 状態

- **初期**: フォームが空、エラーなし
- **バリデーションエラー**: `validationError !== null` — `<p role="alert">` でインライン表示
- **送信中（loading）**: `isSubmitting = true` → ボタン `disabled:opacity-50`
- **登録エラー**: `errorMessage !== null` — Supabase からのエラー（メール既存など）を表示
- **成功**: `/today` へリダイレクト。初期タスク 6 件 + 時間帯 2 件が DB 側で自動生成済み

## レスポンシブ

- **〜640px**: ログイン画面と同一。`max-w-md` がほぼフル幅でエッジ余白 `p-6`
- **〜1024px**: `max-w-md (448px)` センタリング。背景が左右に広がるシンプルな構成
- **1025px〜**: 同上。ワイド画面でも 448px 幅のカードが中央に表示される

## アクセシビリティ

- メールアドレス input: `type="email"` + `autoComplete="email"` — ブラウザ補完対応
- パスワード input: `type="password"` + `autoComplete="new-password"` — パスワードマネージャー生成を促す
- エラーメッセージは `role="alert"` — 内容変化時にスクリーンリーダーが自動読み上げ
- `noValidate` でブラウザ既定バリデーション UI を無効化し、一貫したエラー表示
- 送信ボタン `type="submit"` で Enter キー送信に対応
- `<label>` wrap でラベルとフィールドが確実に関連付けられる
- コントラスト: `bg-game-accent (#4cc9f0)` + `text-game-bg (#0b0d12)` — 高コントラスト確保

## 既存スタイル参照

- `apps/habits/src/features/auth/Signup.tsx` — コンテナ (`mx-auto max-w-md space-y-6 p-6`)、タイトル (`text-2xl font-bold text-game-accent`)
- `apps/habits/src/features/auth/AuthForm.tsx` — 入力フィールド (`rounded border border-gray-500 bg-transparent px-3 py-2`)、ボタン (`w-full rounded bg-game-accent px-4 py-2 font-medium text-game-bg disabled:opacity-50`)
- `packages/config-tailwind/src/theme.css` — `--color-game-accent: #4cc9f0`, `--color-game-bg: #0b0d12`
