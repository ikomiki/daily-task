# 時間帯設定（/settings/time-slots）

## 目的

- `state$.time_slots` から時間帯一覧を取得・表示し、CRUD 操作を提供する
- 「時間帯を追加」ボタン → インライン `TimeSlotEditor` でフォームを展開・作成
- 「編集」ボタン → 対象行を `TimeSlotEditor` に差し替えてインライン編集
- 削除時は「最低 1 件」ガードと「参照タスクあり」ガードを `deleteTimeSlot()` の戻り値で確認し、エラー表示する

## 表示要素

- ページ: `routes/settings/SettingsTimeSlotsPage.tsx` → `TimeSlotList` をレンダリング
- `TimeSlotList` コンポーネント（`features/timeslot/TimeSlotList.tsx`）:
  - 時間帯一覧: `<ul class="space-y-2">` → 各 `<li class="flex items-center gap-3 rounded border border-gray-700 p-3">`
  - 時間帯名: `text-sm font-medium`
  - 通知時刻: `text-xs text-gray-400` （`HH:MM` 形式、`trimSeconds()` で `:SS` を除去）
  - 「編集」ボタン: `rounded border border-gray-500 px-3 py-1 text-sm`
  - 「削除」ボタン: `rounded border border-red-500 px-3 py-1 text-sm text-red-400`
  - 削除エラー: `<p role="alert" class="text-sm text-red-400">`
  - 「時間帯を追加」ボタン: `rounded border border-gray-500 px-3 py-1 text-sm`
- `TimeSlotEditor` コンポーネント（`features/timeslot/TimeSlotEditor.tsx`）:
  - フォームコンテナ: `space-y-3 rounded border border-gray-600 p-3`
  - 時間帯名入力: `<input type="text" aria-label="時間帯名">`
  - 通知時刻: `<input type="time" aria-label="通知時刻">`
  - 「保存」/ 「作成」ボタン: `rounded bg-game-accent px-3 py-1 text-sm font-medium text-game-bg`
  - 「キャンセル」ボタン: `rounded border border-gray-500 px-3 py-1 text-sm`

## インタラクション

- 「時間帯を追加」ボタン: `mode = { type: 'new' }` → リスト下部に `TimeSlotEditor` を展開
- `TimeSlotEditor` 作成送信: `createTimeSlot({ name, notify_at, sort_order: maxOrder + 1 })` → `mode = 'list'`
- 「編集」ボタン: `mode = { type: 'edit', id }` → 対象 `<li>` が `TimeSlotEditor` に切り替わる
- `TimeSlotEditor` 更新送信: `updateTimeSlot(id, values)` → `mode = 'list'`
- 「キャンセル」: `mode = 'list'` に戻り、フォームを閉じる
- 「削除」ボタン: `deleteTimeSlot(id)` 呼び出し。`!result.ok` のとき `errorMessage` を表示
- `TimeSlotEditor` バリデーション: 時間帯名が空のとき `validationError` をインライン表示

## 状態

- **通常（list）**: 時間帯一覧を表示、エラーなし
- **追加中（new）**: リスト下部に `TimeSlotEditor` が展開
- **編集中（edit, id）**: 対象行が `TimeSlotEditor` に差し替わる
- **削除エラー**: `errorMessage !== null` — 「最低 1 件必要」または「参照タスクあり」メッセージ
- **バリデーションエラー**: `TimeSlotEditor` 内で `validationError` を `<p role="alert">` 表示

## レスポンシブ

- **〜640px**: 各行のボタン群（編集 + 削除）が折り返す可能性あり。`TimeSlotEditor` フォームはフル幅
- **〜1024px**: コンテナ幅（親ページ `max-w-2xl`）でセンタリング。行は横並び
- **1025px〜**: 同上。`max-w-2xl` で固定幅を維持

## アクセシビリティ

- `TimeSlotEditor` の入力に `aria-label` 付与（`"時間帯名"`, `"通知時刻"`）
- エラーメッセージは `role="alert"` — 両コンポーネント共通
- 削除ボタンはテキスト「削除」だが視覚的に `text-red-400` で危険操作を示す（追加で `aria-label="○○を削除"` 推奨）
- `input[type="time"]` でネイティブ時刻ピッカーを活用（モバイル対応）
- 「キャンセル」ボタンは `type="button"` — フォーム送信を防止
- `<ul>` / `<li>` 構造で時間帯リストをリストとしてマークアップ
- フォーカス管理: モード切替時に `TimeSlotEditor` 内の先頭入力にフォーカスを移動することを推奨

## 既存スタイル参照

- `apps/habits/src/features/timeslot/TimeSlotList.tsx` — 行 (`flex items-center gap-3 rounded border border-gray-700 p-3`)、削除ボタン (`rounded border border-red-500 px-3 py-1 text-sm text-red-400`)、エラー (`text-sm text-red-400`)
- `apps/habits/src/features/timeslot/TimeSlotEditor.tsx` — フォームコンテナ (`space-y-3 rounded border border-gray-600 p-3`)、保存ボタン (`rounded bg-game-accent px-3 py-1 text-sm font-medium text-game-bg`)、入力 (`block w-full rounded border border-gray-500 bg-transparent px-2 py-1`)
- `packages/config-tailwind/src/theme.css` — `--color-game-accent: #4cc9f0`, `--color-game-bg: #0b0d12`
