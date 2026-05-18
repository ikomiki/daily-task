import { refreshTaskStashView } from '@org/habit-sync';
import type React from 'react';
import { useEffect } from 'react';
import { useTaskStashList } from '../../hooks/useTaskStashList.js';
import { PendingSyncBadge } from './PendingSyncBadge.js';
import { StashRow } from './StashRow.js';

export function StashPanel(): React.ReactElement {
  const rows = useTaskStashList();

  // task_stash_view は Realtime 非対応なため、マウント時に最新データを直接フェッチする。
  // task_logs 操作→DB トリガー→task_stash 更新の伝播遅延をここで吸収する。
  useEffect(() => {
    void refreshTaskStashView();
  }, []);

  return (
    <div className="space-y-4">
      <PendingSyncBadge />
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">
          まだ集計対象のタスクがありません。タスクを追加するか、操作してから戻ってください。
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <StashRow key={row.task_id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
