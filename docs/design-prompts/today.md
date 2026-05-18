# 今日のタスク（/today）

## 目的

- 当日 (`getTodayDateString()` で取得) に実施すべきタスクを時間帯グループごとに一覧表示する
- StatusButtons で完了 / スキップ / 失敗を楽観更新し、`state$.task_logs` に即座に反映する
- `PendingSyncBadge` でオフライン状態や未同期の書き込みを可視化する
- アプリの主画面であり、ナビゲーションの起点となる

## 表示要素

- `<section class="mx-auto max-w-2xl p-6 space-y-6">` — ページコンテナ（`max-w-2xl`）
- ヘッダー: `<h1 class="text-2xl font-bold text-game-accent">今日のタスク</h1>`
- ナビゲーション（`<nav class="flex items-center gap-2">`）: タスク管理 / スタッシュ / カレンダー / 履歴 / 設定 / ログアウト — 各リンクは `rounded border border-gray-500 px-3 py-1 text-sm`
- `TodayView` → `TimeSlotGroup` の繰り返し:
  - `<h2 class="text-lg font-semibold text-game-accent">` — 時間帯名
  - `<span class="text-sm text-gray-400">` — 通知時刻（HH:MM）
  - `<ul class="divide-y divide-gray-700">` → `TodayTaskItem` × N
- `TodayTaskItem`: タスク名（`flex-1 text-sm`）+ `StatusButtons`（完了・スキップ・失敗の 3 ボタン）
- `StatusButtons`: 各ボタン `rounded border px-3 py-1 text-sm`。アクティブ時: 完了=`bg-green-600`、スキップ=`bg-yellow-600`、失敗=`bg-red-600`; 非アクティブ時: `bg-transparent border-gray-500`
- タスク 0 件の場合: `<p class="text-sm text-gray-400">` で「今日のタスクはありません」

## インタラクション

- 完了ボタン押下: `setTaskLogStatus(taskId, today, 'complete')` で `state$.task_logs` を楽観更新
- スキップ / 失敗も同様に対応するステータスで更新
- 同一ボタンを再度押下: `clearTaskLogStatus(taskId, today)` で empty 状態に戻す
- 別ボタン押下: 既存ログを上書きして新しいステータスに切り替え
- `ボタン[aria-pressed="true"]` がアクティブ状態の視覚フィードバック
- ログアウトボタン: `signOut()` → `/auth/login` へリダイレクト

## 状態

- **初期 / 空**: タスク 0 件のとき「今日のタスクはありません」メッセージ
- **通常**: 時間帯グループ × タスク行 × StatusButtons が表示
- **pending-sync / offline**: `PendingSyncBadge` が `useOnlineStatus() === false` のとき（オフライン時）表示（amber 系バナー）
- **楽観更新中**: 操作は即座に UI 反映、バックグラウンドで Supabase に同期

## レスポンシブ

- **〜640px**: ナビゲーションが折り返し（`flex-wrap`）。StatusButtons の 3 ボタンは横並びを維持
- **〜1024px**: `max-w-2xl (672px)` 幅でコンテナがセンタリング。ナビバーが横一列に収まる
- **1025px〜**: 同上。ワイド画面でも `max-w-2xl` で読みやすい幅を維持

## アクセシビリティ

- `StatusButtons` の各ボタンに `aria-pressed` — スクリーンリーダーがトグル状態を正確に伝達
- `<ul>` / `<li>` 構造で タスクリストをリスト要素としてマークアップ
- 時間帯グループは `<section>` + `<header>` + `<h2>` で適切な見出し階層
- ナビゲーションは `<nav>` でランドマーク化
- ボタンはすべて `type="button"` で意図しないフォーム送信を防止
- `text-game-fg (#e6e8ef)` on `bg-game-bg (#0b0d12)` — WCAG AA 基準以上のコントラスト
- アクティブ状態の `bg-green-600` / `bg-yellow-600` / `bg-red-600` は白テキストと高コントラスト

## 既存スタイル参照

- `apps/habits/src/features/today/Today.tsx` — コンテナ (`mx-auto max-w-2xl p-6 space-y-6`)、ナビリンク (`rounded border border-gray-500 px-3 py-1 text-sm`)
- `apps/habits/src/features/today/TimeSlotGroup.tsx` — グループヘッダー (`text-lg font-semibold text-game-accent`)、区切り (`divide-y divide-gray-700`)
- `apps/habits/src/features/today/TodayTaskItem.tsx` — タスク行 (`flex items-center justify-between gap-3 py-2`)
- `apps/habits/src/features/today/StatusButtons.tsx` — ボタンベース (`rounded border px-3 py-1 text-sm`)、アクティブクラス (`bg-green-600 text-white`, `bg-yellow-600 text-white`, `bg-red-600 text-white`)、非アクティブ (`bg-transparent text-game-fg border-gray-500`)
- `packages/config-tailwind/src/theme.css` — `--color-game-accent`, `--color-game-fg`, `--color-game-bg`
