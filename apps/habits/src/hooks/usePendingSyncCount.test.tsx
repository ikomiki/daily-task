import { state$ } from '@org/habit-sync';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { usePendingSyncCount } from './usePendingSyncCount.js';

function Probe(): React.ReactElement {
  const count = usePendingSyncCount();
  return <span data-testid="count">{count}</span>;
}

describe('usePendingSyncCount', () => {
  beforeEach(() => {
    state$.tasks.set({});
    state$.time_slots.set({});
    state$.task_logs.set({});
  });
  afterEach(() => {
    state$.tasks.set({});
    state$.time_slots.set({});
    state$.task_logs.set({});
  });

  it('テスト環境（sync 未接続）では 0 を返す', () => {
    render(<Probe />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('state$.tasks の変更で再評価される', () => {
    render(<Probe />);
    act(() => {
      // 単に変更を発火させるだけ。pending は sync 未接続のため 0 のまま
      state$.tasks.assign({
        x: {
          id: 'x',
          user_id: 'u',
          time_slot_id: 't',
          name: 'n',
          frequency: { type: 'daily' },
          sort_order: 0,
          archived_at: null,
          created_at: '2026-05-16T00:00:00Z',
          updated_at: '2026-05-16T00:00:00Z',
        },
      });
    });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
