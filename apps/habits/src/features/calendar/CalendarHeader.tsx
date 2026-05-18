import type { Task } from '@org/habit-sync';
import { Button, SelectInput } from '@org/ui';
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
      <SelectInput
        aria-label="タスク選択"
        label="タスク選択"
        value={props.selectedId ?? ''}
        onChange={(e) => props.onSelectTask(e.target.value)}
        options={props.tasks.map((t) => ({ value: t.id, label: t.name }))}
      />
      <div className="flex items-center justify-between">
        <Button type="button" aria-label="前月" onClick={props.onPrevMonth}>
          ←
        </Button>
        <span data-testid="cal-month-label" className="text-lg font-semibold">
          {formatYearMonth(props.yearMonth)}
        </span>
        <Button type="button" aria-label="次月" onClick={props.onNextMonth}>
          →
        </Button>
      </div>
    </div>
  );
}
