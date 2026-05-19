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

function buildCellClass(s: DisplayTaskStatus, dim: boolean, isToday: boolean): string {
  // ベースクラス
  const base =
    'aspect-square inline-flex items-center justify-center rounded-full text-[13px] transition-colors hover:bg-surface-2';

  // dim（月外 or 対象外）
  if (dim) {
    const todayClass = isToday ? ' shadow-[inset_0_0_0_2px_var(--color-cal-today)]' : '';
    return `${base} text-cal-dim opacity-50 disabled:cursor-default${todayClass}`;
  }

  // 今日リング
  const todayClass = isToday ? ' shadow-[inset_0_0_0_2px_var(--color-cal-today)]' : '';

  switch (s) {
    case 'complete':
      return `${base} bg-cal-complete text-game-bg font-semibold${todayClass}`;
    case 'fail':
      return `${base} text-cal-fail font-semibold${todayClass}`;
    case 'skip':
      return `${base} text-cal-skip font-semibold${todayClass}`;
    case 'empty':
      return `${base} text-game-fg${todayClass}`;
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
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(date)}
      data-testid="cal-cell"
      data-date={date}
      data-today={isToday ? '1' : '0'}
      aria-label={`${date} ${STATUS_LABEL[status]}`}
      className={buildCellClass(status, dim, isToday)}
    >
      {status === 'fail' ? '×' : status === 'skip' ? '–' : day}
    </button>
  );
}
