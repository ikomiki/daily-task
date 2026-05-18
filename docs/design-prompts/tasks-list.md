# タスク管理（/tasks）

## 目的

- `state$.tasks` から全タスクを取得し、アクティブ / アーカイブ済みに分けて一覧表示する
- タスクの新規追加ボタンから `/tasks/new` へ遷移、`TaskCard` の編集ボタンから `/tasks/$id` へ遷移する
- アーカイブ / 復元操作を `archiveTask()` / `unarchiveTask()` でインライン実行する
- `sort_order` 昇順で表示し、時間帯名と頻度サマリを各カードに付加する

## 表示要素

- ページ: `routes/tasks/TasksPage.tsx` が `TaskList` をレンダリング
- 「新規追加」ボタン: `routes/tasks/TasksPage.tsx` 内、`/tasks/new` へリンクまたはナビゲート
- `TaskList` コンポーネント（`features/task/TaskList.tsx`）:
  - アクティブタスク: `<ul class="space-y-2">` → `TaskCard` × N
  - アーカイブ済みトグルボタン: `text-sm text-gray-400 underline` — 件数付き
  - アーカイブ済みリスト: `<ul class="space-y-2">` → `TaskCard` × N（`opacity-60` 適用）
- `TaskCard` コンポーネント（`features/task/TaskCard.tsx`）:
  - コンテナ: `flex items-center gap-3 rounded border border-gray-700 p-3`
  - タスク名: `text-sm font-medium`
  - サブテキスト: `text-xs text-gray-400` — 時間帯名 ／ `formatFrequency()` によるサマリ
  - アクティブ時ボタン: 「編集」「アーカイブ」 — `rounded border border-gray-500 px-3 py-1 text-sm`
  - アーカイブ済み時ボタン: 「復元」のみ — 同スタイル
- タスク 0 件: `<p class="text-sm text-gray-400">` で「タスクが登録されていません」

## インタラクション

- 「編集」ボタン: `onEdit(taskId)` → `TasksPage` で `/tasks/${taskId}` へナビゲート
- 「アーカイブ」ボタン: `archiveTask(taskId)` を即座に呼び出し（legend-state 楽観更新）
- 「復元」ボタン: `unarchiveTask(taskId)` で `archived_at` を null に戻す
- 「アーカイブ済を表示 (N)」ボタン: `showArchived` トグルで折り畳み/展開
- 状態は `state$.tasks` をリアクティブ購読（`use$(() => ...)` ）— 操作後 UI が即時反映

## 状態

- **空**: タスク 0 件のとき案内テキストを表示
- **通常**: アクティブタスク一覧を表示。アーカイブ済みは折り畳み
- **アーカイブ展開**: `showArchived = true` のとき `opacity-60` のカード列を表示
- **loading**: legend-state の初回ロード中は `state$.tasks` が空のため空状態と同一見た目

## レスポンシブ

- **〜640px**: `TaskCard` 内のボタン群が折り返す場合あり。カード幅はフル幅
- **〜1024px**: ページコンテナは `TasksPage` の親（`Today.tsx` 系の `max-w-2xl`）でセンタリング
- **1025px〜**: `max-w-2xl` を超える幅では左右に余白。カード幅は固定で読みやすさ維持

## アクセシビリティ

- `<ul>` / `<li>` 構造でタスクリストをリストとしてマークアップ
- アーカイブトグルボタン: `type="button"` — テキストに件数が入り支援技術に件数が伝わる
- 編集・アーカイブ・復元ボタンはすべて `type="button"` でフォーム送信を防止
- アーカイブ済みカードの `opacity-60` は視覚的区別のみ（aria-disabled 相当のラベルは TaskCard 拡張で追加可）
- `formatFrequency()` で機械的でない自然言語サマリを提供（スクリーンリーダーでも理解しやすい）
- `text-gray-400` 使用箇所はコントラスト注意 — 装飾的テキストとして扱う場合を除き WCAG AA 対応が必要

## 既存スタイル参照

- `apps/habits/src/features/task/TaskList.tsx` — アーカイブトグルボタン (`text-sm text-gray-400 underline`)、リスト (`space-y-2`)
- `apps/habits/src/features/task/TaskCard.tsx` — カード (`flex items-center gap-3 rounded border border-gray-700 p-3`)、サブテキスト (`text-xs text-gray-400`)、ボタン (`rounded border border-gray-500 px-3 py-1 text-sm`)、アーカイブ済み (`opacity-60`)
- `apps/habits/src/lib/frequency-format.ts` — `formatFrequency()` によるサマリ文字列
- `packages/config-tailwind/src/theme.css` — `--color-game-fg`, `--color-game-bg`, `--color-game-accent`
