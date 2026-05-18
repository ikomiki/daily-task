import type { DisplayTaskStatus } from '@org/habit-sync';
import type React from 'react';

export interface CalendarCellProps {
  date: string;
  isCurrentMonth: boolean;
  isDue: boolean;
  isFuture: boolean;
  isToday: boolean;
  status: DisplayTaskStatus;
  onClick: (date: string) => void;
}

const STATUS_LABEL: Record<DisplayTaskStatus, string> = {
  empty: '未設定',
  complete: '完了',
  fail: '失敗',
  skip: 'スキップ',
};

function statusClass(s: DisplayTaskStatus, dim: boolean): string {
  if (dim) {
    return 'text-cal-dim';
  }
  switch (s) {
    case 'complete':
      return 'bg-cal-complete text-white';
    case 'fail':
      return 'text-cal-fail';
    case 'skip':
      return 'text-cal-skip';
    case 'empty':
      return 'text-game-fg';
  }
}

export function CalendarCell({
  date,
  isCurrentMonth,
  isDue,
  isFuture,
  isToday,
  status,
  onClick,
}: CalendarCellProps): React.ReactElement {
  const day = Number.parseInt(date.slice(8, 10), 10);
  const disabled = !isDue || isFuture;
  const dim = !isCurrentMonth || !isDue;
  const todayRing = isToday ? 'ring-2 ring-cal-today' : '';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(date)}
      data-testid="cal-cell"
      data-date={date}
      data-today={isToday ? '1' : '0'}
      aria-label={`${date} ${STATUS_LABEL[status]}`}
      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm ${statusClass(status, dim)} ${todayRing} disabled:cursor-not-allowed`}
    >
      {status === 'fail' ? '×' : status === 'skip' ? '–' : day}
    </button>
  );
}
