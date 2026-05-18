import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarCellModel } from '../../hooks/useTaskCalendar.js';
import { CalendarGrid } from './CalendarGrid.js';

function mkCells(): CalendarCellModel[] {
  const cells: CalendarCellModel[] = [];
  for (let i = 0; i < 42; i++) {
    cells.push({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      isCurrentMonth: true,
      isDue: true,
      isFuture: false,
      isToday: false,
      status: 'empty',
    });
  }
  return cells;
}

describe('CalendarGrid', () => {
  it('曜日見出しを日曜始まりで表示', () => {
    render(<CalendarGrid cells={mkCells()} onCellClick={vi.fn()} />);
    const heads = screen.getAllByTestId('weekday-head');
    expect(heads.map((h) => h.textContent)).toEqual(['日', '月', '火', '水', '木', '金', '土']);
  });

  it('42 個のセルを描画する', () => {
    render(<CalendarGrid cells={mkCells()} onCellClick={vi.fn()} />);
    expect(screen.getAllByTestId('cal-cell')).toHaveLength(42);
  });
});
