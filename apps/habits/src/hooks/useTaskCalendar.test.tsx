import type { Task, TaskLog } from '@org/habit-sync';
import { state$ } from '@org/habit-sync';
import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadTaskHistoryMock = vi.fn();
const setTaskLogStatusMock = vi.fn();
const clearTaskLogStatusMock = vi.fn();
const refreshTaskStashViewMock = vi.fn();
vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    loadTaskHistory: (...args: unknown[]): unknown => loadTaskHistoryMock(...args),
    setTaskLogStatus: (...args: unknown[]): unknown => setTaskLogStatusMock(...args),
    clearTaskLogStatus: (...args: unknown[]): unknown => clearTaskLogStatusMock(...args),
    refreshTaskStashView: (...args: unknown[]): unknown => refreshTaskStashViewMock(...args),
  };
});
vi.mock('../lib/supabase.js', () => ({ getAppSupabase: (): unknown => ({}) }));

import { useTaskCalendar } from './useTaskCalendar.js';

const NOW = '2026-05-18T00:00:00Z';
function mkTask(id: string, freq: unknown, createdAt = NOW): Task {
  return {
    id,
    user_id: 'u',
    time_slot_id: 's1',
    name: 'T',
    // biome-ignore lint/suspicious/noExplicitAny: テスト用
    frequency: freq as any,
    sort_order: 0,
    archived_at: null,
    created_at: createdAt,
    updated_at: NOW,
  };
}
function mkLog(taskId: string, date: string, status: 'complete' | 'fail' | 'skip'): TaskLog {
  return { task_id: taskId, date, status, created_at: NOW, updated_at: NOW };
}

interface ProbeProps {
  taskId: string | null;
  today: string;
}
function Probe({ taskId, today }: ProbeProps): React.ReactElement {
  const { yearMonth, cells, toggleCell, goPrevMonth, goNextMonth } = useTaskCalendar(taskId, today);
  return (
    <div>
      <span data-testid="ym">{yearMonth}</span>
      <ul>
        {cells.map((c) => (
          <li
            key={c.date}
            data-testid="cell"
            data-date={c.date}
            data-status={c.status}
            data-due={c.isDue ? '1' : '0'}
            data-future={c.isFuture ? '1' : '0'}
            data-current={c.isCurrentMonth ? '1' : '0'}
          >
            {c.date}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          void toggleCell('2026-05-10');
        }}
      >
        toggle10
      </button>
      <button type="button" onClick={goPrevMonth}>
        prev
      </button>
      <button type="button" onClick={goNextMonth}>
        next
      </button>
    </div>
  );
}

beforeEach(() => {
  loadTaskHistoryMock.mockReset();
  setTaskLogStatusMock.mockReset();
  clearTaskLogStatusMock.mockReset();
  refreshTaskStashViewMock.mockReset();
  state$.tasks.set({});
  state$.task_logs.set({});
});
afterEach(() => {
  state$.tasks.set({});
  state$.task_logs.set({});
});

describe('useTaskCalendar', () => {
  it('today の年月を初期表示し、42 セル返す', () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    render(<Probe taskId="a" today="2026-05-18" />);
    expect(screen.getByTestId('ym')).toHaveTextContent('2026-05');
    expect(screen.getAllByTestId('cell')).toHaveLength(42);
  });

  it('isDueOn=false の日は isDue=0', () => {
    // weekday=月,水,金 (1,3,5) のみ
    state$.tasks.assign({
      a: mkTask('a', { type: 'weekday', days: [1, 3, 5] }, '2026-01-01'),
    });
    render(<Probe taskId="a" today="2026-05-18" />);
    const cells = screen.getAllByTestId('cell');
    // 2026-05-10 は日曜 → false
    const sun = cells.find((c) => c.getAttribute('data-date') === '2026-05-10');
    expect(sun?.getAttribute('data-due')).toBe('0');
    // 2026-05-11 は月曜 → true
    const mon = cells.find((c) => c.getAttribute('data-date') === '2026-05-11');
    expect(mon?.getAttribute('data-due')).toBe('1');
  });

  it('未来日は isFuture=1', () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    render(<Probe taskId="a" today="2026-05-18" />);
    const cells = screen.getAllByTestId('cell');
    const future = cells.find((c) => c.getAttribute('data-date') === '2026-05-19');
    expect(future?.getAttribute('data-future')).toBe('1');
    const today = cells.find((c) => c.getAttribute('data-date') === '2026-05-18');
    expect(today?.getAttribute('data-future')).toBe('0');
  });

  it('state$.task_logs の status を反映する', () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    state$.task_logs.assign({
      'a-2026-05-10': mkLog('a', '2026-05-10', 'complete'),
      'a-2026-05-11': mkLog('a', '2026-05-11', 'fail'),
    });
    render(<Probe taskId="a" today="2026-05-18" />);
    const cells = screen.getAllByTestId('cell');
    expect(
      cells.find((c) => c.getAttribute('data-date') === '2026-05-10')?.getAttribute('data-status'),
    ).toBe('complete');
    expect(
      cells.find((c) => c.getAttribute('data-date') === '2026-05-11')?.getAttribute('data-status'),
    ).toBe('fail');
    expect(
      cells.find((c) => c.getAttribute('data-date') === '2026-05-12')?.getAttribute('data-status'),
    ).toBe('empty');
  });

  it('toggleCell は empty→complete で setTaskLogStatus("complete") を呼ぶ', async () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    render(<Probe taskId="a" today="2026-05-18" />);
    await act(async () => {
      screen.getByRole('button', { name: 'toggle10' }).click();
    });
    expect(setTaskLogStatusMock).toHaveBeenCalledWith('a', '2026-05-10', 'complete');
    expect(refreshTaskStashViewMock).toHaveBeenCalled();
  });

  it('toggleCell は skip → empty (clearTaskLogStatus) を呼ぶ', async () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    state$.task_logs.assign({
      'a-2026-05-10': mkLog('a', '2026-05-10', 'skip'),
    });
    render(<Probe taskId="a" today="2026-05-18" />);
    await act(async () => {
      screen.getByRole('button', { name: 'toggle10' }).click();
    });
    expect(clearTaskLogStatusMock).toHaveBeenCalledWith('a', '2026-05-10');
  });

  it('未来日のトグルは何もしない', async () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    function ProbeFuture(): React.ReactElement {
      const { toggleCell } = useTaskCalendar('a', '2026-05-09');
      return (
        <button
          type="button"
          onClick={() => {
            void toggleCell('2026-05-10');
          }}
        >
          t
        </button>
      );
    }
    render(<ProbeFuture />);
    await act(async () => {
      screen.getByRole('button', { name: 't' }).click();
    });
    expect(setTaskLogStatusMock).not.toHaveBeenCalled();
    expect(clearTaskLogStatusMock).not.toHaveBeenCalled();
  });

  it('isDue=false 日のトグルは何もしない', async () => {
    state$.tasks.assign({
      a: mkTask('a', { type: 'weekday', days: [2] }, '2026-01-01'), // 火曜のみ
    });
    render(<Probe taskId="a" today="2026-05-18" />);
    // 2026-05-10 は日曜 → not due
    await act(async () => {
      screen.getByRole('button', { name: 'toggle10' }).click();
    });
    expect(setTaskLogStatusMock).not.toHaveBeenCalled();
  });

  it('goPrevMonth で表示年月が前月になる', () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }) });
    render(<Probe taskId="a" today="2026-05-18" />);
    act(() => {
      screen.getByRole('button', { name: 'prev' }).click();
    });
    expect(screen.getByTestId('ym')).toHaveTextContent('2026-04');
  });

  it('cutoff より古い月への切替で loadTaskHistory を呼ぶ', async () => {
    state$.tasks.assign({ a: mkTask('a', { type: 'daily' }, '2025-01-01') });
    loadTaskHistoryMock.mockResolvedValueOnce([mkLog('a', '2026-01-15', 'complete')]);
    render(<Probe taskId="a" today="2026-05-18" />);
    // 4 月前へ移動: 2026-01
    await act(async () => {
      screen.getByRole('button', { name: 'prev' }).click();
      screen.getByRole('button', { name: 'prev' }).click();
      screen.getByRole('button', { name: 'prev' }).click();
      screen.getByRole('button', { name: 'prev' }).click();
    });
    expect(loadTaskHistoryMock).toHaveBeenCalled();
  });
});
