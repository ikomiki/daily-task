import { type Observable, syncState } from '@legendapp/state';
import type { SyncStateShape } from './observables.js';

// state$ 配下の sync 対象キーを横断して pending な書き込み件数の合計を返す。
// 未接続のキーは 0 として扱う。
const SYNCED_KEYS = ['tasks', 'time_slots', 'task_logs'] as const;

export function getPendingSyncCount(state$: Observable<SyncStateShape>): number {
  let total = 0;
  for (const key of SYNCED_KEYS) {
    try {
      const sync = syncState((state$ as unknown as Record<string, Observable<unknown>>)[key]);
      const pending = sync.numPendingSets?.get();
      if (typeof pending === 'number') {
        total += pending;
      }
    } catch {
      // syncObservable 未接続のキーは syncState が throw する可能性がある → 無視して 0 扱い
    }
  }
  return total;
}
