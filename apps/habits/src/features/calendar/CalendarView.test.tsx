import { state$, type Task } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    loadTaskHistory: vi.fn(),
    setTaskLogStatus: vi.fn(),
    clearTaskLogStatus: vi.fn(),
    refreshTaskStashView: vi.fn(),
  };
});
vi.mock('../../lib/supabase.js', () => ({ getAppSupabase: (): unknown => ({}) }));
vi.mock('../../lib/today-date.js', () => ({ getTodayDateString: (): string => '2026-05-18' }));

import { CalendarView } from './CalendarView.js';

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
    created_at: '2026-01-01T00:00:00Z',
    updated_at: NOW,
  };
}

beforeEach(() => {
  state$.tasks.set({});
  state$.task_logs.set({});
});
afterEach(() => {
  state$.tasks.set({});
  state$.task_logs.set({});
});

describe('CalendarView', () => {
  it('タスクが無いとき空状態メッセージ', () => {
    render(<CalendarView />);
    expect(screen.getByText(/タスクが登録されていません/)).toBeInTheDocument();
  });

  it('タスクがあると CalendarHeader + CalendarGrid を描画', () => {
    state$.tasks.assign({ a: mkTask('a', 'A') });
    render(<CalendarView />);
    expect(screen.getByRole('combobox', { name: 'タスク選択' })).toBeInTheDocument();
    expect(screen.getAllByTestId('cal-cell')).toHaveLength(42);
  });
});
