# スタッシュ（/stash）

## 目的

- `useTaskStashList()` フックで `state$.task_stash_view` と `state$.tasks` を結合し、タスクごとの集計統計を一覧表示する
- 完了数 / スキップ数 / 失敗数 / 連続日数 / 対象日数 / 完了率 / 最終完了日を `StashRow` でカード形式で表示する
- `PendingSyncBadge` でオフライン状態を可視化し、集計が古い可能性をユーザーに伝える
- ページマウント時に `refreshTaskStashView()` を呼び出し、DB トリガー伝播後の最新集計を取得する

## 表示要素

- `StashPanel` コンポーネント（`features/stash/StashPanel.tsx`）:
  - `PendingSyncBadge`: オフライン時に amber バナーを表示（`role="status"`）
  - データあり: `<div class="space-y-3">` → `StashRow` × N
  - データなし: `<p class="text-sm text-gray-400">` で案内テキスト
- `StashRow` コンポーネント（`features/stash/StashRow.tsx`）:
  - コンテナ: `article class="rounded border border-gray-700 bg-gray-900/40 p-3 space-y-2"`
  - ヘッダー: タスク名（`text-base font-semibold`）+ 時間帯名（`text-xs text-gray-400`）
  - 集計グリッド: `<dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4">`
    - 完了数 / スキップ数 / 失敗数 / 連続日数: `formatStashCount()` でフォーマット
    - 対象日数 / 完了率: それぞれ `formatStashCount()` / `formatCompletionRate()` でフォーマット
    - 最終完了日: `col-span-2` + `formatLastCompletedDate()` で null セーフフォーマット
- `PendingSyncBadge`（`features/stash/PendingSyncBadge.tsx`）:
  - `useOnlineStatus()` で `online` 取得
  - オフライン時: `rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200` のバナー

## インタラクション

- ページマウント: `useEffect(() => refreshTaskStashView(), [])` — Realtime 非対応の view を手動リフレッシュ
- データは `useTaskStashList()` がリアクティブ購読（`state$.task_stash_view` + `state$.tasks` の join）
- オフライン遷移: `useOnlineStatus()` が `online$` を購読 → `PendingSyncBadge` が自動表示
- オンライン復帰: `PendingSyncBadge` が非表示に戻る（`online = true` → `null` レンダリング）
- 表示は read-only（集計への直接書き込みは不可）

## 状態

- **空**: `rows.length === 0` — タスク未追加または操作履歴なし
- **通常**: `StashRow` × N を表示
- **offline**: `PendingSyncBadge` が amber バナーとして表示
- **loading / 初回マウント**: `refreshTaskStashView()` が非同期で実行中。一時的に古い集計を表示する場合がある

## レスポンシブ

- **〜640px**: `StashRow` の `dl` は `grid-cols-2`（完了・スキップ / 失敗・連続 で 2 列）。ヘッダーは `flex-wrap`
- **〜1024px**: `md:grid-cols-4` が適用され 4 列グリッドで横並び表示。コンテナは `max-w-2xl` でセンタリング
- **1025px〜**: 同上。`max-w-2xl` で幅固定。`StashRow` の `article` はフル幅

## アクセシビリティ

- `PendingSyncBadge` に `role="status"` — 状態変化をスクリーンリーダーがポーリングなしに伝達
- `StashRow` は `<article>` でセマンティックに独立したコンテンツとしてマークアップ
- `<dl>` / `<dt>` / `<dd>` の説明リスト構造で統計ラベルと値を関連付け
- 完了率 `formatCompletionRate()` は null セーフ（`null` の場合は `-` 表示）
- 最終完了日 `formatLastCompletedDate()` は null セーフ（未記録時は「記録なし」相当の表示）
- `text-gray-400` の `<dt>` はラベルとして機能、コントラスト注意（補助的テキストとして許容）
- `bg-amber-500/10 text-amber-200` のバナーは WCAG AA に近いが高コントラストモード対応を検討

## 既存スタイル参照

- `apps/habits/src/features/stash/StashPanel.tsx` — レイアウト (`space-y-4`)、空状態 (`text-sm text-gray-400`)
- `apps/habits/src/features/stash/StashRow.tsx` — カード (`rounded border border-gray-700 bg-gray-900/40 p-3 space-y-2`)、グリッド (`grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4`)
- `apps/habits/src/features/stash/PendingSyncBadge.tsx` — バナー (`flex flex-wrap items-center gap-2 rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200`)
- `apps/habits/src/lib/stash-format.ts` — `formatStashCount()`, `formatCompletionRate()`, `formatLastCompletedDate()`
- `packages/config-tailwind/src/theme.css` — `--color-game-accent`, `--color-game-fg`, `--color-game-bg`
- M14: StashRow が `bg-surface-2` Card + dl グリッド + streak バッジ + `bg-status-*` 3 色プログレスバー。
