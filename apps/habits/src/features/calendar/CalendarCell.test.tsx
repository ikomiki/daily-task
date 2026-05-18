import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarCell } from './CalendarCell.js';

describe('CalendarCell', () => {
  it('日付の日成分を表示する', () => {
    render(
      <CalendarCell
        date="2026-05-15"
        isCurrentMonth
        isDue
        isFuture={false}
        isToday={false}
        status="empty"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('15');
  });

  it('complete 状態で aria-label に「完了」を含む', () => {
    render(
      <CalendarCell
        date="2026-05-15"
        isCurrentMonth
        isDue
        isFuture={false}
        isToday={false}
        status="complete"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('完了'),
    );
  });

  it('isDue=false なら disabled', () => {
    render(
      <CalendarCell
        date="2026-05-15"
        isCurrentMonth
        isDue={false}
        isFuture={false}
        isToday={false}
        status="empty"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('isFuture=true なら disabled', () => {
    render(
      <CalendarCell
        date="2026-05-30"
        isCurrentMonth
        isDue
        isFuture
        isToday={false}
        status="empty"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('クリックで onClick(date) を呼ぶ', () => {
    const onClick = vi.fn();
    render(
      <CalendarCell
        date="2026-05-15"
        isCurrentMonth
        isDue
        isFuture={false}
        isToday={false}
        status="empty"
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('2026-05-15');
  });

  it('isToday=true は data-today="1"', () => {
    render(
      <CalendarCell
        date="2026-05-18"
        isCurrentMonth
        isDue
        isFuture={false}
        isToday
        status="empty"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button')).toHaveAttribute('data-today', '1');
  });
});
