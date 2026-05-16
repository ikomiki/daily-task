import type { Frequency } from '@org/habit-core';
import { state$ } from './observables.js';
import type { Task } from './types.js';

// 新規タスク作成の入力。id / user_id / created_at / updated_at / archived_at は内部で埋める。
export interface CreateTaskInput {
  name: string;
  time_slot_id: string;
  frequency: Frequency;
  sort_order: number;
}

// state$.tasks に新規タスクを追加。uuid を発行して返す。
// user 未認証時は throw する（呼び出し側のバグ）。
export function createTask(input: CreateTaskInput): string {
  const userId = state$.user.get()?.id;
  if (userId === undefined) {
    throw new Error('createTask: 未認証状態です。state$.user が null。');
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: Task = {
    id,
    user_id: userId,
    time_slot_id: input.time_slot_id,
    name: input.name,
    frequency: input.frequency as unknown as Task['frequency'],
    sort_order: input.sort_order,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };
  // legend-state の動的キーアクセスは型推論が深くなりすぎるため peek して assign する
  state$.tasks.assign({ [id]: row });
  return id;
}

export type UpdateTaskInput = Partial<{
  name: string;
  time_slot_id: string;
  frequency: Frequency;
  sort_order: number;
}>;

// state$.tasks の既存タスクを部分更新する。updated_at を自動更新する。
// 存在しない id は no-op（例外なし）。
export function updateTask(id: string, patch: UpdateTaskInput): void {
  const current = state$.tasks.get()[id];
  if (current === undefined) {
    return;
  }
  const next: Task = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.time_slot_id !== undefined ? { time_slot_id: patch.time_slot_id } : {}),
    ...(patch.frequency !== undefined
      ? { frequency: patch.frequency as unknown as Task['frequency'] }
      : {}),
    ...(patch.sort_order !== undefined ? { sort_order: patch.sort_order } : {}),
    updated_at: new Date().toISOString(),
  };
  state$.tasks.assign({ [id]: next });
}

// タスクをアーカイブする。archived_at に現在時刻を設定する。
// 存在しない id は no-op。
export function archiveTask(id: string): void {
  const current = state$.tasks.get()[id];
  if (current === undefined) {
    return;
  }
  const now = new Date().toISOString();
  state$.tasks.assign({ [id]: { ...current, archived_at: now, updated_at: now } });
}

// タスクのアーカイブを解除する。archived_at を null に戻す。
// 存在しない id は no-op。
export function unarchiveTask(id: string): void {
  const current = state$.tasks.get()[id];
  if (current === undefined) {
    return;
  }
  state$.tasks.assign({
    [id]: { ...current, archived_at: null, updated_at: new Date().toISOString() },
  });
}
