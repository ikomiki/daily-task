import { type NotificationProvider, state$, type Task, type TimeSlot } from '@org/habit-sync';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotificationManager } from './NotificationManager.js';

const NOW = '2026-05-16T00:00:00Z';
const TODAY = '2026-05-16';

function mkSlot(over: Partial<TimeSlot> & { id: string }): TimeSlot {
  return {
    id: over.id,
    user_id: 'u',
    name: over.name ?? 'slot',
    notify_at: '09:00:00',
    sort_order: 0,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}
function mkTask(over: Partial<Task> & { id: string }): Task {
  return {
    id: over.id,
    user_id: 'u',
    time_slot_id: 's1',
    name: over.name ?? `t-${over.id}`,
    frequency: { type: 'daily' },
    sort_order: 0,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
}

function makeProvider(): NotificationProvider & {
  scheduleCalls: { slots: unknown; onFire: (s: { slotId: string }) => void }[];
  cancelCalls: number;
  shownCalls: { title: string; body?: string }[];
} {
  const scheduleCalls: { slots: unknown; onFire: (s: { slotId: string }) => void }[] = [];
  const shownCalls: { title: string; body?: string }[] = [];
  let cancelCalls = 0;
  return {
    scheduleCalls,
    shownCalls,
    get cancelCalls() {
      return cancelCalls;
    },
    requestPermission: async () => 'granted',
    scheduleDaily(slots, onFire) {
      // biome-ignore lint/suspicious/noExplicitAny: テスト用
      scheduleCalls.push({ slots, onFire: onFire as any });
    },
    cancelAll() {
      cancelCalls += 1;
    },
    show(title, body) {
      shownCalls.push({ title, body });
    },
  } as ReturnType<typeof makeProvider>;
}

beforeEach(() => {
  state$.tasks.set({});
  state$.task_logs.set({});
  state$.time_slots.set({});
});
afterEach(() => {
  state$.tasks.set({});
  state$.task_logs.set({});
  state$.time_slots.set({});
});

describe('NotificationManager', () => {
  it('マウント時に provider.scheduleDaily を呼ぶ', () => {
    state$.time_slots.assign({ s1: mkSlot({ id: 's1' }) });
    const provider = makeProvider();
    render(<NotificationManager provider={provider} today={TODAY} />);
    expect(provider.scheduleCalls).toHaveLength(1);
    expect(provider.scheduleCalls[0].slots).toEqual([
      { slotId: 's1', slotName: 'slot', notifyAt: '09:00:00' },
    ]);
  });

  it('time_slots 変化で reschedule（cancelAll が呼ばれる）', () => {
    state$.time_slots.assign({ s1: mkSlot({ id: 's1' }) });
    const provider = makeProvider();
    render(<NotificationManager provider={provider} today={TODAY} />);
    const initialSchedules = provider.scheduleCalls.length;
    // legend-state の変化を React に反映させるために act でラップする
    act(() => {
      state$.time_slots.assign({ s1: mkSlot({ id: 's1' }), s2: mkSlot({ id: 's2', name: '夜' }) });
    });
    expect(provider.scheduleCalls.length).toBeGreaterThan(initialSchedules);
  });

  it('unmount で cancelAll を呼ぶ', () => {
    state$.time_slots.assign({ s1: mkSlot({ id: 's1' }) });
    const provider = makeProvider();
    const { unmount } = render(<NotificationManager provider={provider} today={TODAY} />);
    const before = provider.cancelCalls;
    unmount();
    expect(provider.cancelCalls).toBeGreaterThan(before);
  });

  it('onFire で未操作タスクが 1 件以上なら show を呼ぶ', () => {
    state$.time_slots.assign({ s1: mkSlot({ id: 's1', name: '朝' }) });
    state$.tasks.assign({
      t1: mkTask({ id: 't1', time_slot_id: 's1', name: 'A' }),
      t2: mkTask({ id: 't2', time_slot_id: 's1', name: 'B' }),
    });
    const provider = makeProvider();
    render(<NotificationManager provider={provider} today={TODAY} />);
    const onFire = provider.scheduleCalls[0].onFire;
    onFire({ slotId: 's1', slotName: '朝', notifyAt: '09:00:00' } as unknown as never);
    expect(provider.shownCalls).toHaveLength(1);
    expect(provider.shownCalls[0].title).toBe('朝');
    expect(provider.shownCalls[0].body).toMatch(/2 件/);
  });

  it('onFire で未操作タスクが 0 件なら show を呼ばない', () => {
    state$.time_slots.assign({ s1: mkSlot({ id: 's1' }) });
    state$.tasks.assign({
      t1: mkTask({ id: 't1', time_slot_id: 's1' }),
    });
    state$.task_logs.assign({
      't1-2026-05-16': {
        task_id: 't1',
        date: '2026-05-16',
        status: 'complete',
        created_at: NOW,
        updated_at: NOW,
      },
    });
    const provider = makeProvider();
    render(<NotificationManager provider={provider} today={TODAY} />);
    const onFire = provider.scheduleCalls[0].onFire;
    onFire({ slotId: 's1', slotName: 'slot', notifyAt: '09:00:00' } as unknown as never);
    expect(provider.shownCalls).toHaveLength(0);
  });
});
