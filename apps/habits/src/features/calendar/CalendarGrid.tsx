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
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAYS.map((w) => (
        <div key={w} data-testid="weekday-head" className="text-center text-xs text-gray-400">
          {w}
        </div>
      ))}
      {cells.map((c) => (
        <div key={c.date} className="flex justify-center">
          <CalendarCell
            date={c.date}
            isCurrentMonth={c.isCurrentMonth}
            isDue={c.isDue}
            isFuture={c.isFuture}
            isToday={c.isToday}
            status={c.status}
            onClick={onCellClick}
          />
        </div>
      ))}
    </div>
  );
}
