import { Card } from '@org/ui';
import type React from 'react';
import type { CalendarCellModel } from '../../hooks/useTaskCalendar.js';
import { CalendarCell } from './CalendarCell.js';

export interface CalendarGridProps {
  cells: CalendarCellModel[];
  onCellClick: (date: string) => void;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function CalendarGrid({ cells, onCellClick }: CalendarGridProps): React.ReactElement {
  return (
    <Card>
      {/* 曜日見出し行 */}
      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            data-testid="weekday-head"
            className="text-xs text-game-fg-muted text-center"
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日付セル */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c) => (
          <CalendarCell
            key={c.date}
            date={c.date}
            isCurrentMonth={c.isCurrentMonth}
            isDue={c.isDue}
            isFuture={c.isFuture}
            isToday={c.isToday}
            status={c.status}
            onClick={onCellClick}
          />
        ))}
      </div>

      {/* 凡例 */}
      <div className="mt-4 flex flex-wrap gap-3.5 text-xs text-game-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-cal-complete" />
          完了
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-bold text-cal-fail">×</span>
          失敗
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-bold text-cal-skip">–</span>
          スキップ
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full shadow-[inset_0_0_0_2px_var(--color-cal-today)]" />
          今日
        </span>
      </div>

      {/* 状態切替の説明 */}
      <p className="mt-2 text-xs text-game-fg-dim">
        セルをクリックすると 完了 → 失敗 → スキップ → 空 の順に状態が切り替わります。
      </p>
    </Card>
  );
}
