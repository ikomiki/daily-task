import { state$, type TodayTaskItem as TodayTaskItemModel } from '@org/habit-sync';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TodayTaskItem } from './TodayTaskItem.js';

const today = '2026-05-16';
const baseItem: TodayTaskItemModel = {
  id: 't1',
  name: '歯磨き',
  status: 'empty',
  sort_order: 0,
};

describe('TodayTaskItem', () => {
  beforeEach(() => {
    state$.task_logs.set({});
  });

  it('タスク名を表示する', () => {
    render(<TodayTaskItem item={baseItem} today={today} />);
    expect(screen.getByText('歯磨き')).toBeInTheDocument();
  });

  it('「完了」クリックで state$.task_logs にエントリが入る', () => {
    render(<TodayTaskItem item={baseItem} today={today} />);
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    const row = state$.task_logs.get()['t1-2026-05-16'];
    expect(row?.status).toBe('complete');
  });

  it('「スキップ」クリックで state$.task_logs に skip が入る', () => {
    render(<TodayTaskItem item={baseItem} today={today} />);
    fireEvent.click(screen.getByRole('button', { name: 'スキップ' }));
    expect(state$.task_logs.get()['t1-2026-05-16']?.status).toBe('skip');
  });

  it('現状 complete のときに「完了」を押すと state$.task_logs[key] が削除される', () => {
    state$.task_logs.set({
      't1-2026-05-16': {
        task_id: 't1',
        date: '2026-05-16',
        status: 'complete',
        created_at: '2026-05-16T00:00:00Z',
        updated_at: '2026-05-16T00:00:00Z',
      },
    });
    render(<TodayTaskItem item={{ ...baseItem, status: 'complete' }} today={today} />);
    fireEvent.click(screen.getByRole('button', { name: '完了' }));
    expect(state$.task_logs.get()['t1-2026-05-16']).toBeUndefined();
  });
});
