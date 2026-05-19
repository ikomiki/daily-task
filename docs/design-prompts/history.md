# 履歴（/history）

## 目的

- `state$.tasks` から全タスク（アクティブ + アーカイブ済み）を name 昇順で取得し、タスク選択 `<select>` を提供する
- 選択タスクの操作ログを日付降順で表示し、直近 31 日は `state$.task_logs` から取得する
- 32 日以前のログは `loadMore()` → `loadTaskHistory()` で Supabase からオンデマンドページング取得する
- ページサイズ未満の結果を受け取ったら `hasMore = false` に切り替え「これ以上履歴はありません」と表示する

## 表示要素

- `HistoryView` コンポーネント（`features/history/HistoryView.tsx`）:
  - タスク選択: `<label class="flex flex-col gap-1 text-sm">` + `<select aria-label="タスク選択" class="rounded border border-gray-500 bg-transparent px-2 py-1">`
  - ログリスト: `<ul class="divide-y divide-gray-700">`
    - 各行 `<li class="flex items-baseline justify-between py-2">`:
      - 日付: `<span class="text-sm">{l.date}</span>`
      - ステータス: `<span class="text-sm text-gray-300">{formatHistoryStatus(l.status)}</span>`
  - ログ 0 件: `<p class="text-sm text-gray-400">このタスクには履歴がありません。</p>`
  - 「もっと読み込む」ボタン: `rounded border border-gray-500 px-3 py-1 text-sm disabled:opacity-50`（`isLoading` 中は「読み込み中...」テキスト）
  - 末尾: `<p class="text-xs text-gray-500">これ以上履歴はありません。</p>`
  - タスク 0 件: `<p class="text-sm text-gray-400">タスクが登録されていません。</p>`

## インタラクション

- ページ初期表示: タスク一覧ロード後、`selectedId` が `null` なら先頭タスクを自動選択
- タスク選択変更: `setSelectedId(id)` → `useTaskHistory(id)` が新しいタスクのログを取得・リセット
- 「もっと読み込む」ボタン: `loadMore()` を呼び出し、32 日以前のログを `loadTaskHistory(client, { taskId, beforeDate, limit })` で追加取得
- `isLoading = true` 中はボタン disabled + テキスト「読み込み中...」に切替
- 取得件数がページサイズ（31 件）未満: `hasMore = false` → ボタン非表示・「これ以上履歴はありません」
- アーカイブ済みタスクも選択肢に表示（履歴閲覧の用途上）

## 状態

- **タスク 0 件**: 案内テキスト表示
- **初期（タスク選択前）**: `selectedId = null` → 一覧ロード後に自動選択
- **通常**: ログ一覧 + `hasMore ? "もっと読み込む" : "これ以上履歴はありません"`
- **ログなし**: 選択タスクの履歴が 0 件のとき「このタスクには履歴がありません」
- **loading（追加取得中）**: `isLoading = true` → ボタン disabled + テキスト変更

## レスポンシブ

- **〜640px**: タスク選択 `<select>` がフル幅。ログ行は日付・ステータスの 2 カラム横並びを維持
- **〜1024px**: コンテナ幅（`max-w-2xl`）でセンタリング。ログリストはフル幅
- **1025px〜**: 同上。`max-w-2xl` で幅固定。長い履歴もスクロールで閲覧可能

## アクセシビリティ

- タスク選択 `<select>` に `aria-label="タスク選択"` — スクリーンリーダーで用途を明示
- ログリストは `<ul>` / `<li>` でリストとしてマークアップ
- 「もっと読み込む」ボタンは `type="button"` — フォーム送信を防止
- `disabled` 状態（isLoading 中）で `disabled:opacity-50` を適用し視覚的フィードバック
- `formatHistoryStatus()` は `'complete' | 'skip' | 'fail'` を日本語ラベルに変換（`apps/habits/src/lib/history-status.ts`）
- `divide-y divide-gray-700` の区切り線は視覚的なログ行の分離に使用
- `data-testid="history-entry"` は E2E テスト用属性（支援技術には影響しない）

## 既存スタイル参照

- `apps/habits/src/features/history/HistoryView.tsx` — タスク選択 (`rounded border border-gray-500 bg-transparent px-2 py-1`)、ログ行 (`flex items-baseline justify-between py-2`)、区切り (`divide-y divide-gray-700`)、ボタン (`rounded border border-gray-500 px-3 py-1 text-sm disabled:opacity-50`)、空状態 (`text-sm text-gray-400`)、末尾テキスト (`text-xs text-gray-500`)
- `apps/habits/src/lib/history-status.ts` — `formatHistoryStatus()` で `'complete' | 'skip' | 'fail'` → 日本語
- `packages/config-tailwind/src/theme.css` — `--color-game-fg: #e6e8ef`, `--color-game-accent: #4cc9f0`
- M14: log エントリが `border-border-default` セパレータ + `font-mono tabular-nums` 日付 + `bg-status-*` ドット。
