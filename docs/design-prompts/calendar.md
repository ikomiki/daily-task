# カレンダー（/calendar）

## 目的

- アクティブタスクをタスク選択 `<select>` で選択し、月別 7×6 グリッド（日曜始まり）でタスクログを可視化する
- `CalendarHeader` で月遷移（前月 / 次月）を提供し、`CalendarGrid` + `CalendarCell` でカレンダーを描画する
- 過去日のセルをクリックすることで empty → complete → fail → skip → empty の状態循環で編集できる
- 未来日と `isDueOn = false` の日は disabled にして誤操作を防ぐ

## 表示要素

- `CalendarView` コンポーネント（`features/calendar/CalendarView.tsx`）:
  - `CalendarHeader` + `CalendarGrid` を縦スタック（`space-y-4`）
- `CalendarHeader`（`features/calendar/CalendarHeader.tsx`）:
  - タスク選択: `<select aria-label="タスク選択" class="rounded border border-gray-500 bg-transparent px-2 py-1">`
  - 月ラベル: `<span class="text-lg font-semibold">YYYY 年 M 月</span>`（`formatYearMonth()` で変換）
  - 前月ボタン: `aria-label="前月"` → `goPrevMonth()`
  - 次月ボタン: `aria-label="次月"` → `goNextMonth()`
- `CalendarGrid`（`features/calendar/CalendarGrid.tsx`）:
  - コンテナ: `grid grid-cols-7 gap-1`
  - 曜日見出し: 日〜土（`text-center text-xs text-gray-400`）
  - 42 セル: `CalendarCell` を `buildCalendarGrid('YYYY-MM')` の結果でレンダリング
- `CalendarCell`（`features/calendar/CalendarCell.tsx`）:
  - セル: `flex h-10 w-10 items-center justify-center rounded-full text-sm`
  - ステータス別クラス:
    - `complete`: `bg-cal-complete text-white`
    - `fail`: `text-cal-fail`（`×` 表示）
    - `skip`: `text-cal-skip`（`–` 表示）
    - `empty`: `text-game-fg`（日付数値表示）
    - 非当月・非 isDue の dim: `text-cal-dim`
  - 今日: `ring-2 ring-cal-today` を追加
  - disabled: `cursor-not-allowed`（未来日 or `isDueOn = false`）

## インタラクション

- ページ初期表示: アクティブタスクの先頭を自動選択（`selectedId = null` → 初回ロード後に設定）
- タスク選択変更: `setSelectedId(id)` → `useTaskCalendar(id, today)` が月カレンダーを再計算
- 「前月」ボタン: `goPrevMonth()` → `yearMonth` を -1 month、月単位ログを `loadTaskLogsInRange()` でフェッチ
- 「次月」ボタン: `goNextMonth()` → `yearMonth` を +1 month（現在月より未来には進めない制約推奨）
- セルクリック: `toggleCell(date)` → `nextCalendarStatus()` でステータスを循環（empty → complete → fail → skip → empty）
- 書き込み後: `refreshTaskStashView()` を呼び出し集計を更新
- 31 日 cutoff 外の書き込みは `monthCache` に merge し、同セッション中の再描画を安定化

## 状態

- **タスク 0 件**: `<p class="text-sm text-gray-400">タスクが登録されていません。</p>`
- **通常**: カレンダーグリッドを表示
- **月遷移中**: 過去月フェッチ中は既存セルを表示しながら背景でロード
- **disabled セル**: 未来日 (`isFuture = true`) または `isDue = false` — クリック不可、`cursor-not-allowed`
- **今日のセル**: `isToday = true` → `ring-2 ring-cal-today` でハイライト

## レスポンシブ

- **〜640px**: `grid-cols-7` 固定のため、セル（`h-10 w-10`）が小画面でも 7 列を維持。画面幅が 320px の場合はセルが若干重なるため、セルサイズの動的調整（`h-9 w-9` など）を検討
- **〜1024px**: `max-w-2xl` コンテナ内でグリッドがゆとりを持って表示
- **1025px〜**: 同上。カレンダーは `max-w-2xl` に収まり、横に広がりすぎない

## アクセシビリティ

- 各 `CalendarCell` に `aria-label={${date} ${STATUS_LABEL[status]}}` — 日付とステータスをスクリーンリーダーに伝達
- 前月 / 次月ボタンに `aria-label="前月"` / `aria-label="次月"` — 矢印アイコンだけでは意味が伝わらないため必須
- タスク選択 `<select>` に `aria-label="タスク選択"`
- disabled セルは `disabled` 属性でキーボード・支援技術からアクセス不可にする
- 曜日見出し（日〜土）は `data-testid="weekday-head"` のみで `<th>` ではないため、`scope` や `<thead>` への移行を推奨
- `ring-2 ring-cal-today (#facc15)` は黄色のリングで今日を明示（色のみへの依存に注意 — テキストや形状による補助も検討）
- `bg-cal-complete (#4cc9f0)` + `text-white` — 十分なコントラスト

## 既存スタイル参照

- `apps/habits/src/features/calendar/CalendarCell.tsx` — セル (`flex h-10 w-10 items-center justify-center rounded-full text-sm`)、ステータスクラス (`bg-cal-complete text-white`, `text-cal-fail`, `text-cal-skip`, `text-game-fg`, `text-cal-dim`)、今日 (`ring-2 ring-cal-today`)
- `apps/habits/src/features/calendar/CalendarGrid.tsx` — グリッド (`grid grid-cols-7 gap-1`)、曜日見出し (`text-center text-xs text-gray-400`)
- `apps/habits/src/features/calendar/CalendarHeader.tsx` — 月ラベル (`text-lg font-semibold`)、ナビボタン (`rounded border border-gray-500 px-3 py-1 text-sm`)
- `apps/habits/src/lib/calendar-status.ts` — `nextCalendarStatus()` 状態循環
- `packages/habit-core/src/month-grid.ts` — `buildCalendarGrid('YYYY-MM')` で 42 セル配列を生成
- `packages/config-tailwind/src/theme.css` — `--color-cal-complete: #4cc9f0`, `--color-cal-fail: #ef4444`, `--color-cal-skip: #9ca3af`, `--color-cal-today: #facc15`, `--color-cal-dim: #374151`
