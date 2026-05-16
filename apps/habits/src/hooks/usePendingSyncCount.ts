import { use$ } from '@legendapp/state/react';
import { getPendingSyncCount, state$ } from '@org/habit-sync';

// state$ 全体の pending な書き込み件数を購読する。
// state$ のいずれかが変わるたびに getPendingSyncCount() が再評価される。
export function usePendingSyncCount(): number {
  return use$(() => {
    // tasks / time_slots / task_logs の get を発火させて依存登録する
    state$.tasks.get();
    state$.time_slots.get();
    state$.task_logs.get();
    return getPendingSyncCount(state$);
  });
}
