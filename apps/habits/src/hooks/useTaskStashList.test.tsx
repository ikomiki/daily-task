import { state$ } from '@org/habit-sync';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTaskStashList } from './useTaskStashList.js';

function Probe(): React.ReactElement {
  const rows = useTaskStashList();
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.task_id} data-testid="row">
          {r.task_name}|{r.slot_name}|{r.complete_count ?? 0}|{r.current_streak ?? 0}
        </li>
      ))}
    </ul>
  );
}

const NOW = '2026-05-16T00:00:00Z';

beforeEach(() => {
  state$.tasks.set({});
  state$.time_slots.set({});
  state$.task_stash_view.set({});
});
afterEach(() => {
  state$.tasks.set({});
  state$.time_slots.set({});
  state$.task_stash_view.set({});
});

describe('useTaskStashList', () => {
  it('tasks / time_slots / stash_view が空のとき空配列', () => {
    render(<Probe />);
    expect(screen.queryAllByTestId('row')).toHaveLength(0);
  });

  it('アクティブタスクのみ返し、archived は除外', () => {
    state$.time_slots.assign({
      s1: {
        id: 's1',
        user_id: 'u',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.tasks.assign({
      a: {
        id: 'a',
        user_id: 'u',
        time_slot_id: 's1',
        name: 'Active',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
      b: {
        id: 'b',
        user_id: 'u',
        time_slot_id: 's1',
        name: 'Archived',
        frequency: { type: 'daily' },
        sort_order: 1,
        archived_at: '2026-05-15T00:00:00Z',
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.task_stash_view.assign({
      a: {
        task_id: 'a',
        user_id: 'u',
        complete_count: 3,
        fail_count: 0,
        skip_count: 1,
        current_streak: 2,
        task_days: 5,
        completion_rate: 0.6,
        last_completed_date: '2026-05-15',
        updated_at: NOW,
      },
      b: {
        task_id: 'b',
        user_id: 'u',
        complete_count: 1,
        fail_count: 0,
        skip_count: 0,
        current_streak: 0,
        task_days: 1,
        completion_rate: 1,
        last_completed_date: '2026-05-10',
        updated_at: NOW,
      },
    });
    render(<Probe />);
    const rows = screen.getAllByTestId('row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Active|朝|3|2');
  });

  it('スロット sort_order → タスク sort_order の順に並ぶ', () => {
    state$.time_slots.assign({
      s1: {
        id: 's1',
        user_id: 'u',
        name: '夜',
        notify_at: '21:00:00',
        sort_order: 1,
        created_at: NOW,
        updated_at: NOW,
      },
      s2: {
        id: 's2',
        user_id: 'u',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.tasks.assign({
      t1: {
        id: 't1',
        user_id: 'u',
        time_slot_id: 's1',
        name: '夜A',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
      t2: {
        id: 't2',
        user_id: 'u',
        time_slot_id: 's2',
        name: '朝B',
        frequency: { type: 'daily' },
        sort_order: 1,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
      t3: {
        id: 't3',
        user_id: 'u',
        time_slot_id: 's2',
        name: '朝A',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.task_stash_view.assign({
      t1: {
        task_id: 't1',
        user_id: 'u',
        complete_count: 0,
        fail_count: 0,
        skip_count: 0,
        current_streak: 0,
        task_days: 0,
        completion_rate: null,
        last_completed_date: null,
        updated_at: NOW,
      },
      t2: {
        task_id: 't2',
        user_id: 'u',
        complete_count: 0,
        fail_count: 0,
        skip_count: 0,
        current_streak: 0,
        task_days: 0,
        completion_rate: null,
        last_completed_date: null,
        updated_at: NOW,
      },
      t3: {
        task_id: 't3',
        user_id: 'u',
        complete_count: 0,
        fail_count: 0,
        skip_count: 0,
        current_streak: 0,
        task_days: 0,
        completion_rate: null,
        last_completed_date: null,
        updated_at: NOW,
      },
    });
    render(<Probe />);
    const rows = screen.getAllByTestId('row');
    expect(rows.map((r) => r.textContent)).toEqual(['朝A|朝|0|0', '朝B|朝|0|0', '夜A|夜|0|0']);
  });

  it('stash_view に行が無いタスクは null 集計でも一覧に出る', () => {
    state$.time_slots.assign({
      s1: {
        id: 's1',
        user_id: 'u',
        name: '朝',
        notify_at: '07:00:00',
        sort_order: 0,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    state$.tasks.assign({
      x: {
        id: 'x',
        user_id: 'u',
        time_slot_id: 's1',
        name: '新タスク',
        frequency: { type: 'daily' },
        sort_order: 0,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      },
    });
    // task_stash_view は空のまま
    render(<Probe />);
    const rows = screen.getAllByTestId('row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('新タスク|朝|0|0');
  });
});
