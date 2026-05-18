import type { Task } from '@org/habit-sync';
import type React from 'react';

export interface CalendarHeaderProps {
  tasks: Task[];
  selectedId: string | null;
  onSelectTask: (id: string) => void;
  yearMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${y} 年 ${m} 月`;
}

export function CalendarHeader(props: CalendarHeaderProps): React.ReactElement {
  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-400">タスク選択</span>
        <select
          aria-label="タスク選択"
          className="rounded border border-gray-500 bg-transparent px-2 py-1"
          value={props.selectedId ?? ''}
          onChange={(e) => props.onSelectTask(e.target.value)}
        >
          {props.tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="前月"
          onClick={props.onPrevMonth}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          ←
        </button>
        <span data-testid="cal-month-label" className="text-lg font-semibold">
          {formatYearMonth(props.yearMonth)}
        </span>
        <button
          type="button"
          aria-label="次月"
          onClick={props.onNextMonth}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          →
        </button>
      </div>
    </div>
  );
}
