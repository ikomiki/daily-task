import type { Task } from '@org/habit-sync';
import { Button, SelectInput } from '@org/ui';
import type React from 'react';

export interface CalendarHeaderProps {
  tasks: Task[];
  selectedId: string | null;
  onSelectTask: (id: string) => void;
  yearMonth: string;
  isAtCurrentMonth: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${y} 年 ${m} 月`;
}

export function CalendarHeader(props: CalendarHeaderProps): React.ReactElement {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <SelectInput
          aria-label="タスク選択"
          label="タスク選択"
          value={props.selectedId ?? ''}
          onChange={(e) => props.onSelectTask(e.target.value)}
          options={props.tasks.map((t) => ({ value: t.id, label: t.name }))}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          type="button"
          aria-label="前月"
          onClick={props.onPrevMonth}
        >
          ←
        </Button>
        <span
          data-testid="cal-month-label"
          className="min-w-[110px] text-center font-semibold tabular-nums"
        >
          {formatYearMonth(props.yearMonth)}
        </span>
        <Button
          size="sm"
          variant="secondary"
          type="button"
          aria-label="次月"
          onClick={props.onNextMonth}
          disabled={props.isAtCurrentMonth}
        >
          →
        </Button>
      </div>
    </div>
  );
}
