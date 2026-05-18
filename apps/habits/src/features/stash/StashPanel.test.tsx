import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskStashRow } from '../../hooks/useTaskStashList.js';
import { StashPanel } from './StashPanel.js';

let mockedRows: TaskStashRow[] = [];

vi.mock('../../hooks/useTaskStashList.js', () => ({
  useTaskStashList: (): TaskStashRow[] => mockedRows,
}));

// PendingSyncBadge は別途テスト済み。ここではマウントを確認するだけ
vi.mock('./PendingSyncBadge.js', () => ({
  PendingSyncBadge: () => <div data-testid="badge" />,
}));

// refreshTaskStashView はネットワーク呼び出しのためモック
vi.mock('@org/habit-sync', () => ({
  refreshTaskStashView: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  mockedRows = [];
});
afterEach(() => {
  mockedRows = [];
});

describe('StashPanel', () => {
  it('PendingSyncBadge を描画する', () => {
    render(<StashPanel />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('rows 空のとき empty メッセージを表示', () => {
    render(<StashPanel />);
    expect(screen.getByText(/まだ集計対象のタスクがありません/)).toBeInTheDocument();
  });

  it('rows が複数あるとき task_name ごとに表示', () => {
    mockedRows = [
      {
        task_id: 'a',
        task_name: 'A',
        slot_name: '朝',
        complete_count: 1,
        fail_count: 0,
        skip_count: 0,
        current_streak: 1,
        task_days: 1,
        completion_rate: 1,
        last_completed_date: '2026-05-16',
      },
      {
        task_id: 'b',
        task_name: 'B',
        slot_name: '夜',
        complete_count: 2,
        fail_count: 0,
        skip_count: 0,
        current_streak: 2,
        task_days: 2,
        completion_rate: 1,
        last_completed_date: '2026-05-16',
      },
    ];
    render(<StashPanel />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
