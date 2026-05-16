import { state$ } from './observables.js';
import type { TimeSlot } from './types.js';

// 新規時間帯作成の入力。id / user_id / created_at / updated_at は内部で埋める。
export interface CreateTimeSlotInput {
  name: string;
  notify_at: string; // 'HH:MM:SS'
  sort_order: number;
}

// 時間帯の部分更新入力。
export type UpdateTimeSlotInput = Partial<{
  name: string;
  notify_at: string;
  sort_order: number;
}>;

// 削除操作の結果。失敗時は reason に理由を格納する。
export type DeleteResult = { ok: true } | { ok: false; reason: string };

// state$.time_slots に新規時間帯を追加。uuid を発行して返す。
// user 未認証時は throw する（呼び出し側のバグ）。
export function createTimeSlot(input: CreateTimeSlotInput): string {
  const userId = state$.user.get()?.id;
  if (userId === undefined) {
    throw new Error('createTimeSlot: 未認証状態です。state$.user が null。');
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row: TimeSlot = {
    id,
    user_id: userId,
    name: input.name,
    notify_at: input.notify_at,
    sort_order: input.sort_order,
    created_at: now,
    updated_at: now,
  };
  // legend-state の動的キーアクセスは型推論が深くなりすぎるため assign を使う
  state$.time_slots.assign({ [id]: row });
  return id;
}

// state$.time_slots の既存時間帯を部分更新する。updated_at を自動更新する。
// 存在しない id は no-op（例外なし）。
export function updateTimeSlot(id: string, patch: UpdateTimeSlotInput): void {
  const current = state$.time_slots.get()[id];
  if (current === undefined) {
    return;
  }
  const next: TimeSlot = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.notify_at !== undefined ? { notify_at: patch.notify_at } : {}),
    ...(patch.sort_order !== undefined ? { sort_order: patch.sort_order } : {}),
    updated_at: new Date().toISOString(),
  };
  state$.time_slots.assign({ [id]: next });
}

// 削除可能条件:
//   1. 削除後に時間帯が 1 件以上残る
//   2. このスロットを参照するタスクが 1 件も無い（archived 含む）
export function deleteTimeSlot(id: string): DeleteResult {
  const slots = state$.time_slots.get();
  if (slots[id] === undefined) {
    // 既に無いなら no-op 成功
    return { ok: true };
  }
  const remainingCount = Object.keys(slots).filter((k) => k !== id).length;
  if (remainingCount < 1) {
    return { ok: false, reason: '時間帯は最低 1 個必要です。' };
  }
  const referencingTasks = Object.values(state$.tasks.get()).filter((t) => t.time_slot_id === id);
  if (referencingTasks.length > 0) {
    return {
      ok: false,
      reason: `この時間帯を参照するタスクが ${referencingTasks.length} 件あります。先に別の時間帯に移動するか削除してください。`,
    };
  }
  state$.time_slots[id].delete();
  return { ok: true };
}
