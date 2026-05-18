import type { Task } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarHeader } from './CalendarHeader.js';

const NOW = '2026-05-18T00:00:00Z';
function mkTask(id: string, name: string): Task {
  return {
    id,
    user_id: 'u',
    time_slot_id: 's1',
    name,
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    frequency: { type: 'daily' } as any,
    sort_order: 0,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

describe('CalendarHeader', () => {
  it('年月ラベルを表示（YYYY 年 M 月）', () => {
    render(
      <CalendarHeader
        tasks={[]}
        selectedId={null}
        onSelectTask={vi.fn()}
        yearMonth="2026-05"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    expect(screen.getByTestId('cal-month-label')).toHaveTextContent('2026 年 5 月');
  });

  it('← ボタンで onPrevMonth、→ で onNextMonth', () => {
    const prev = vi.fn();
    const next = vi.fn();
    render(
      <CalendarHeader
        tasks={[]}
        selectedId={null}
        onSelectTask={vi.fn()}
        yearMonth="2026-05"
        onPrevMonth={prev}
        onNextMonth={next}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '前月' }));
    expect(prev).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '次月' }));
    expect(next).toHaveBeenCalled();
  });

  it('タスク select 変更で onSelectTask(id)', () => {
    const onSel = vi.fn();
    render(
      <CalendarHeader
        tasks={[mkTask('a', 'A'), mkTask('b', 'B')]}
        selectedId="a"
        onSelectTask={onSel}
        yearMonth="2026-05"
        onPrevMonth={vi.fn()}
        onNextMonth={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'タスク選択' }), {
      target: { value: 'b' },
    });
    expect(onSel).toHaveBeenCalledWith('b');
  });
});
