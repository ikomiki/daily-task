import { state$, type TaskLog } from '@org/habit-sync';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadTaskHistoryMock = vi.fn();
vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    loadTaskHistory: (...args: unknown[]): unknown => loadTaskHistoryMock(...args),
  };
});

vi.mock('../../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({}),
}));

import { HistoryView } from './HistoryView.js';

const NOW = '2026-05-16T00:00:00Z';

function mkLog(taskId: string, date: string, status: 'complete' | 'skip' | 'fail'): TaskLog {
  return { task_id: taskId, date, status, created_at: NOW, updated_at: NOW };
}

beforeEach(() => {
  loadTaskHistoryMock.mockReset();
  state$.tasks.set({});
  state$.task_logs.set({});
  state$.time_slots.set({});
});
afterEach(() => {
  loadTaskHistoryMock.mockReset();
  state$.tasks.set({});
  state$.task_logs.set({});
  state$.time_slots.set({});
});

describe('HistoryView', () => {
  it('タスクが無いとき空状態メッセージを表示', () => {
    render(<HistoryView />);
    expect(screen.getByText(/タスクが登録されていません/)).toBeInTheDocument();
  });

  it('タスクを select で表示し、選択中タスクの履歴を一覧表示', () => {
    state$.tasks.assign({
      a: {
        id: 'a',
        user_id: 'u',
        time_slot_id: 's1',
        name: '歯を磨く',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.task_logs.assign({
      'a-2026-05-15': mkLog('a', '2026-05-15', 'complete'),
      'a-2026-05-14': mkLog('a', '2026-05-14', 'fail'),
    });
    render(<HistoryView />);
    expect(screen.getByRole('combobox', { name: 'タスク選択' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '歯を磨く' })).toBeInTheDocument();
    const rows = screen.getAllByTestId('history-entry');
    expect(rows[0]).toHaveTextContent('2026-05-15');
    expect(rows[0]).toHaveTextContent('完了');
    expect(rows[1]).toHaveTextContent('2026-05-14');
    expect(rows[1]).toHaveTextContent('失敗');
  });

  it('アーカイブ済タスクも選択肢に出す', () => {
    state$.tasks.assign({
      x: {
        id: 'x',
        user_id: 'u',
        time_slot_id: 's1',
        name: 'アーカイブ済',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: '2026-05-15T00:00:00Z',
        created_at: NOW,
        updated_at: NOW,
      },
    });
    render(<HistoryView />);
    expect(screen.getByRole('option', { name: 'アーカイブ済' })).toBeInTheDocument();
  });

  it('hasMore=true のとき「もっと読み込む」ボタンを表示し、クリックで loadTaskHistory が呼ばれる', async () => {
    state$.tasks.assign({
      a: {
        id: 'a',
        user_id: 'u',
        time_slot_id: 's1',
        name: 'A',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.task_logs.assign({
      'a-2026-05-15': mkLog('a', '2026-05-15', 'complete'),
    });
    loadTaskHistoryMock.mockResolvedValueOnce([mkLog('a', '2026-04-30', 'complete')]);
    render(<HistoryView />);
    const btn = screen.getByRole('button', { name: 'もっと読み込む' });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(loadTaskHistoryMock).toHaveBeenCalled();
  });

  it('hasMore=false（loadMore 後に短い batch）でボタンが消える', async () => {
    state$.tasks.assign({
      a: {
        id: 'a',
        user_id: 'u',
        time_slot_id: 's1',
        name: 'A',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.task_logs.assign({
      'a-2026-05-15': mkLog('a', '2026-05-15', 'complete'),
    });
    loadTaskHistoryMock.mockResolvedValueOnce([]);
    render(<HistoryView />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'もっと読み込む' }));
    });
    expect(screen.queryByRole('button', { name: 'もっと読み込む' })).not.toBeInTheDocument();
    expect(screen.getByText(/これ以上履歴はありません/)).toBeInTheDocument();
  });
});
