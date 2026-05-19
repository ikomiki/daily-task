# タスク作成 / 編集（/tasks/new および /tasks/$id）

## 目的

- 新規タスク作成（`TaskNewPage`）と既存タスク編集（`TaskEditPage`）を共通の `TaskForm` + `FrequencyPicker` で実装する
- タスク名・時間帯・頻度（5 モード）を設定し `createTask()` / `updateTask()` を呼び出す
- 時間帯が 0 件の場合に警告を表示し、送信をブロックする
- 保存後は `/tasks` へリダイレクトする

## 表示要素

- `TaskForm` コンポーネント（`features/task/TaskForm.tsx`）:
  - タスク名入力: `<input aria-label="タスク名" class="block w-full rounded border border-gray-500 bg-transparent px-3 py-2">`
  - 時間帯 `<select aria-label="時間帯">`: `state$.time_slots` から選択肢を生成
  - 頻度フィールドセット: `<fieldset>` + `<legend>頻度</legend>` → `FrequencyPicker`
  - 時間帯未登録の警告: `<p role="alert" class="text-sm text-red-400">`
  - バリデーションエラー: `<p role="alert" class="text-sm text-red-400">`
  - 送信ボタン: `rounded bg-game-accent px-4 py-2 font-medium text-game-bg disabled:opacity-50`
- `FrequencyPicker` コンポーネント（`features/task/FrequencyPicker.tsx`）:
  - 頻度タイプ `<select aria-label="頻度の種類">`: 毎日 / N 日ごと / 曜日指定 / 曜日+第 n 週 / N 週ごと
  - `every_n_days`: n（数値入力）+ 開始日（`type="date"`）
  - `weekday` / `day_of_week`: 曜日チェックボックス（月〜日、ISO 1〜7）
  - `day_of_week`: さらに第 n 週チェックボックス（第 1〜5 週）
  - `every_n_weeks`: n（数値）+ 曜日 `<select>` + 開始日

## インタラクション

- タスク名が空のまま送信: `validationError = 'タスク名を入力してください。'` を表示
- 時間帯が未選択で送信: `validationError = '時間帯を選択してください。'` を表示
- 時間帯が 0 件: 送信ボタン `disabled` + 警告アラート表示
- `FrequencyPicker` の頻度タイプ変更: `defaultForType(type)` でデフォルト値にリセット
- `weekday` / `day_of_week` の曜日チェックボックス: `toggleDay()` で配列を管理
- `day_of_week` の第 n 週チェックボックス: 選択なしの場合 `weeks_of_month` を `undefined` に
- 送信成功: `onSubmit()` コールバック → 親（`TaskNewPage` / `TaskEditPage`）が `/tasks` へリダイレクト

## 状態

- **新規 (TaskNewPage)**: フォームは空（デフォルト: 頻度=`daily`、時間帯=先頭スロット）
- **編集 (TaskEditPage)**: `initial` props で既存値を表示
- **バリデーションエラー**: `validationError !== null` → `<p role="alert">` 表示
- **時間帯未登録**: `noSlots = true` → 送信ボタン disabled + 設定誘導アラート
- **頻度タイプ切替**: タイプに応じた入力要素が動的レンダリング（条件付きサブフォーム）

## レスポンシブ

- **〜640px**: フォームフィールドが縦スタック。曜日チェックボックスが `flex-wrap` で折り返す
- **〜1024px**: コンテナ幅（`TasksPage` 親の `max-w-2xl`）でセンタリング。フォームは全幅
- **1025px〜**: 同上。`max-w-2xl` 制約でフォームが横に広がりすぎない

## アクセシビリティ

- タスク名・時間帯・頻度タイプには `aria-label` で明示的なラベルを付与
- 頻度フィールドセットは `<fieldset>` + `<legend>` でグループとしてマークアップ
- 曜日チェックボックスは `<fieldset>` + `<legend>曜日</legend>` + 各 `<label>` で正しく関連付け
- エラーメッセージは `role="alert"` — スクリーンリーダーが変化時に読み上げ
- 送信ボタンは `type="submit"` — Enter キー送信対応
- `disabled` 状態（時間帯 0 件時）でフォーカス不可・`opacity-50` で視覚的に無効化
- `input[type="date"]` / `input[type="number"]` のネイティブ実装でモバイルキーボードを最適化

## 既存スタイル参照

- `apps/habits/src/features/task/TaskForm.tsx` — 入力フィールド (`block w-full rounded border border-gray-500 bg-transparent px-3 py-2`)、ボタン (`rounded bg-game-accent px-4 py-2 font-medium text-game-bg disabled:opacity-50`)、アラート (`text-sm text-red-400`)
- `apps/habits/src/features/task/FrequencyPicker.tsx` — セレクト (`block w-full rounded border border-gray-500 bg-transparent px-2 py-1`)、チェックボックスラベル (`flex items-center gap-1 text-sm`)、数値入力 (`block w-32 rounded border border-gray-500 bg-transparent px-2 py-1`)
- `packages/config-tailwind/src/theme.css` — `--color-game-accent: #4cc9f0`, `--color-game-bg: #0b0d12`
- M14: TaskForm の submit エリアに `flex justify-end gap-2`。`AlertText` でバリデーションエラー表示。
