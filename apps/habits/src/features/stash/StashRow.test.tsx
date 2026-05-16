import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TaskStashRow } from '../../hooks/useTaskStashList.js';
import { StashRow } from './StashRow.js';

const FULL: TaskStashRow = {
  task_id: 't1',
  task_name: '歯を磨く',
  slot_name: '朝',
  complete_count: 12,
  fail_count: 1,
  skip_count: 2,
  current_streak: 5,
  task_days: 20,
  completion_rate: 0.6,
  last_completed_date: '2026-05-15',
};

describe('StashRow', () => {
  it('タスク名と時間帯名を表示する', () => {
    render(<StashRow row={FULL} />);
    expect(screen.getByText('歯を磨く')).toBeInTheDocument();
    expect(screen.getByText('朝')).toBeInTheDocument();
  });

  it('各カウントとフォーマット済み値を表示する', () => {
    render(<StashRow row={FULL} />);
    expect(screen.getByText('12')).toBeInTheDocument(); // complete
    expect(screen.getByText('1')).toBeInTheDocument(); // fail
    expect(screen.getByText('2')).toBeInTheDocument(); // skip
    expect(screen.getByText('5')).toBeInTheDocument(); // streak
    expect(screen.getByText('20')).toBeInTheDocument(); // task_days
    expect(screen.getByText('60%')).toBeInTheDocument(); // completion_rate
    expect(screen.getByText('2026-05-15')).toBeInTheDocument();
  });

  it('null カラムは 0 または — で表示する', () => {
    const empty: TaskStashRow = {
      ...FULL,
      complete_count: null,
      fail_count: null,
      skip_count: null,
      current_streak: null,
      task_days: null,
      completion_rate: null,
      last_completed_date: null,
    };
    render(<StashRow row={empty} />);
    // 0 が複数出る（complete/fail/skip/streak/task_days = 5 個）
    expect(screen.getAllByText('0')).toHaveLength(5);
    // completion_rate と last_completed_date は —
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});
