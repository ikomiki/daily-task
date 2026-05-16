import { state$, type TaskLog } from '@org/habit-sync';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// loadTaskHistory をモック化（後続テストで戻り値を切替）
const loadTaskHistoryMock = vi.fn();
vi.mock('@org/habit-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@org/habit-sync')>();
  return {
    ...actual,
    loadTaskHistory: (...args: unknown[]): unknown => loadTaskHistoryMock(...args),
  };
});

// supabase は呼び出さない（loadTaskHistory がモックされるため）
vi.mock('../lib/supabase.js', () => ({
  getAppSupabase: (): unknown => ({}),
}));

import { useTaskHistory } from './useTaskHistory.js';

interface ProbeProps {
  taskId: string | null;
}

function Probe({ taskId }: ProbeProps): React.ReactElement {
  const { logs, hasMore, isLoading, loadMore } = useTaskHistory(taskId);
  return (
    <div>
      <ul>
        {logs.map((l) => (
          <li key={`${l.task_id}-${l.date}`} data-testid="row">
            {l.date}|{l.status}
          </li>
        ))}
      </ul>
      <span data-testid="hasMore">{hasMore ? 'yes' : 'no'}</span>
      <span data-testid="isLoading">{isLoading ? 'yes' : 'no'}</span>
      <button
        type="button"
        onClick={() => {
          void loadMore();
        }}
      >
        loadMore
      </button>
    </div>
  );
}

const NOW = '2026-05-16T00:00:00Z';

function mkLog(taskId: string, date: string, status: 'complete' | 'skip' | 'fail'): TaskLog {
  return { task_id: taskId, date, status, created_at: NOW, updated_at: NOW };
}

beforeEach(() => {
  loadTaskHistoryMock.mockReset();
  state$.task_logs.set({});
});
afterEach(() => {
  loadTaskHistoryMock.mockReset();
  state$.task_logs.set({});
});

describe('useTaskHistory', () => {
  it('taskId が null のとき空配列・hasMore=false', () => {
    render(<Probe taskId={null} />);
    expect(screen.queryAllByTestId('row')).toHaveLength(0);
    expect(screen.getByTestId('hasMore')).toHaveTextContent('no');
  });

  it('state$.task_logs から該当 task の log を date 降順で返す', () => {
    state$.task_logs.assign({
      'a-2026-05-10': mkLog('a', '2026-05-10', 'complete'),
      'a-2026-05-12': mkLog('a', '2026-05-12', 'skip'),
      'a-2026-05-11': mkLog('a', '2026-05-11', 'fail'),
      'b-2026-05-10': mkLog('b', '2026-05-10', 'complete'),
    });
    render(<Probe taskId="a" />);
    const rows = screen.getAllByTestId('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      '2026-05-12|skip',
      '2026-05-11|fail',
      '2026-05-10|complete',
    ]);
  });

  it('loadMore で取得分を末尾にマージする', async () => {
    state$.task_logs.assign({
      'a-2026-05-12': mkLog('a', '2026-05-12', 'complete'),
      'a-2026-05-10': mkLog('a', '2026-05-10', 'fail'),
    });
    loadTaskHistoryMock.mockResolvedValueOnce([
      mkLog('a', '2026-04-30', 'complete'),
      mkLog('a', '2026-04-20', 'skip'),
    ]);
    render(<Probe taskId="a" />);
    expect(screen.getAllByTestId('row')).toHaveLength(2);

    await act(async () => {
      screen.getByRole('button', { name: 'loadMore' }).click();
    });

    expect(loadTaskHistoryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ taskId: 'a', beforeDate: '2026-05-10', limit: 31 }),
    );
    const rows = screen.getAllByTestId('row');
    expect(rows.map((r) => r.textContent)).toEqual([
      '2026-05-12|complete',
      '2026-05-10|fail',
      '2026-04-30|complete',
      '2026-04-20|skip',
    ]);
  });

  it('返却件数が limit 未満なら hasMore=false', async () => {
    state$.task_logs.assign({
      'a-2026-05-10': mkLog('a', '2026-05-10', 'complete'),
    });
    loadTaskHistoryMock.mockResolvedValueOnce([mkLog('a', '2026-04-30', 'complete')]);
    render(<Probe taskId="a" />);

    await act(async () => {
      screen.getByRole('button', { name: 'loadMore' }).click();
    });

    expect(screen.getByTestId('hasMore')).toHaveTextContent('no');
  });

  it('既存ログが無い状態で loadMore しても fetch しない', async () => {
    render(<Probe taskId="a" />);
    await act(async () => {
      screen.getByRole('button', { name: 'loadMore' }).click();
    });
    expect(loadTaskHistoryMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('hasMore')).toHaveTextContent('no');
  });
});
