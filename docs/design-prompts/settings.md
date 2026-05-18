# 通知設定（/settings/notifications）

## 目的

- `useNotificationPermission()` フックで `Notification.permission` の現在値を取得・表示する
- `permission === 'prompt'` のとき「通知を許可する」ボタンを表示し、`request()` でブラウザ許可ダイアログを起動する
- v1 はフォアグラウンド通知のみ（アプリを開いている間のみ）であることをユーザーに説明する
- 時間帯設定（`/settings/time-slots`）と今日のタスク（`/today`）へのナビゲーションを提供する

## 表示要素

- `SettingsNotificationsPage` コンポーネント（`routes/settings/SettingsNotificationsPage.tsx`）
- コンテナ: `<section class="mx-auto max-w-2xl p-6 space-y-6">`
- `<h1 class="text-2xl font-bold text-game-accent">通知設定</h1>`
- ナビゲーション: 「時間帯」(`/settings/time-slots`) / 「今日のタスク」(`/today`) — `rounded border border-gray-500 px-3 py-1 text-sm`
- ステータス表示: `<p class="text-sm">現在のステータス: <span class="font-mono">{permissionLabel}</span></p>`
  - `granted` → 「許可済み」
  - `denied` → 「拒否」
  - `prompt` → 「未許可」
  - `unsupported` → 「お使いのブラウザは通知非対応」
- `permission === 'prompt'` のとき「通知を許可する」ボタン: `rounded border border-gray-500 px-3 py-1 text-sm`
- 補足説明: `<p class="text-xs text-gray-500">` — フォアグラウンド通知の制約説明

## インタラクション

- ページロード時: `useNotificationPermission()` が `Notification.permission` を読み取り `permission` state に格納
- 「通知を許可する」ボタン押下: `request()` を呼び出し → ブラウザの許可ダイアログが表示
- ダイアログで「許可」: `permission` が `'granted'` に更新 → ボタンが非表示になる
- ダイアログで「拒否」: `permission` が `'denied'` に更新 → ボタンが非表示になる（ブラウザ設定から変更が必要な旨を伝えることを推奨）
- `NotificationManager`（`features/notify/NotificationManager.tsx`）が `state$.time_slots` を購読し、各スロットの `notify_at` 時刻に `setTimeout` を予約

## 状態

- **prompt（デフォルト/未許可）**: ステータス「未許可」 + 「通知を許可する」ボタン表示
- **granted（許可済み）**: ステータス「許可済み」 + ボタン非表示
- **denied（拒否済み）**: ステータス「拒否」 + ボタン非表示（ブラウザ設定での変更を促す説明を追加推奨）
- **unsupported（非対応）**: ステータス「お使いのブラウザは通知非対応」 + ボタン非表示

## レスポンシブ

- **〜640px**: ナビゲーションリンクが `flex-wrap` で折り返す可能性あり。コンテンツは縦スタック
- **〜1024px**: `max-w-2xl` でセンタリング。シンプルなコンテンツのため余白は広め
- **1025px〜**: 同上。通知設定はシンプルな 1 カラム構成で十分

## アクセシビリティ

- `permission` の値は `<span class="font-mono">` でモノスペースフォント表示（機械的な値であることを示す）
- 「通知を許可する」ボタンは `type="button"` — フォーム送信を防止
- ボタン非表示の条件は `permission === 'prompt' ? <button> : null` — DOM から除去されるため `aria-hidden` 不要
- `text-gray-500` の補足説明はコントラスト比が低いため純粋な装飾的テキストとして扱う
- 補足説明は `<p>` でセマンティックにマークアップ
- ナビゲーションリンクは `<nav>` ランドマーク推奨（現状 `<nav>` タグあり）
- `useNotificationPermission()` は `'default'` を `'prompt'` に正規化 — 支援技術に「未許可」として伝達

## 既存スタイル参照

- `apps/habits/src/routes/settings/SettingsNotificationsPage.tsx` — コンテナ (`mx-auto max-w-2xl p-6 space-y-6`)、ステータスラベル (`font-mono`)、ボタン (`rounded border border-gray-500 px-3 py-1 text-sm`)、補足 (`text-xs text-gray-500`)
- `apps/habits/src/hooks/useNotificationPermission.ts` — `permission` / `request` を提供、`'default'` → `'prompt'` に正規化
- `packages/config-tailwind/src/theme.css` — `--color-game-accent: #4cc9f0` (タイトル)、`--color-game-fg: #e6e8ef`
