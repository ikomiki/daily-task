import { describe, expect, it } from 'vitest';
import type { Task, TaskLog, TaskStashView, TaskStatus, TimeSlot } from './types.js';

describe('types', () => {
  it('Task 型が必要なフィールドを持つ', () => {
    const t: Task = {
      id: 't1',
      user_id: 'u1',
      time_slot_id: 's1',
      name: 'タスク',
      frequency: { type: 'daily' },
      sort_order: 0,
      archived_at: null,
      created_at: '2026-05-16T00:00:00Z',
      updated_at: '2026-05-16T00:00:00Z',
    };
    expect(t.id).toBe('t1');
  });

  it('TimeSlot 型が必要なフィールドを持つ', () => {
    const s: TimeSlot = {
      id: 's1',
      user_id: 'u1',
      name: '朝',
      notify_at: '07:00:00',
      sort_order: 0,
      created_at: '2026-05-16T00:00:00Z',
      updated_at: '2026-05-16T00:00:00Z',
    };
    expect(s.name).toBe('朝');
  });

  it('TaskLog 型が必要なフィールドを持つ', () => {
    const l: TaskLog = {
      task_id: 't1',
      date: '2026-05-16',
      status: 'complete',
      created_at: '2026-05-16T00:00:00Z',
      updated_at: '2026-05-16T00:00:00Z',
    };
    expect(l.status).toBe('complete');
  });

  it('TaskStatus は complete/skip/fail のいずれか', () => {
    const s1: TaskStatus = 'complete';
    const s2: TaskStatus = 'skip';
    const s3: TaskStatus = 'fail';
    expect([s1, s2, s3]).toEqual(['complete', 'skip', 'fail']);
  });

  it('TaskStashView 型が VIEW の出力を表現する', () => {
    const v: TaskStashView = {
      task_id: 't1',
      user_id: 'u1',
      complete_count: 5,
      fail_count: 1,
      skip_count: 2,
      current_streak: 3,
      last_completed_date: '2026-05-15',
      task_days: 10,
      completion_rate: 0.5,
      updated_at: '2026-05-16T00:00:00Z',
    };
    expect(v.task_days).toBe(10);
  });
});
