import { refreshTaskStashView } from '@org/habit-sync';
import { PageHeader } from '@org/ui';
import type React from 'react';
import { useEffect } from 'react';
import { useTaskStashList } from '../../hooks/useTaskStashList.js';
import { formatCompletionRate } from '../../lib/stash-format.js';
import { PendingSyncBadge } from './PendingSyncBadge.js';
import { StashRow } from './StashRow.js';

export function StashPanel(): React.ReactElement {
  const rows = useTaskStashList();

  // task_stash_view は Realtime 非対応なため、マウント時に最新データを直接フェッチする。
  // task_logs 操作→DB トリガー→task_stash 更新の伝播遅延をここで吸収する。
  useEffect(() => {
    void refreshTaskStashView();
  }, []);

  // 全体完了率: 全タスクの complete_count / task_days の合算
  const totals = rows.reduce(
    (acc, r) => {
      acc.complete += r.complete_count ?? 0;
      acc.target += r.task_days ?? 0;
      return acc;
    },
    { complete: 0, target: 0 },
  );
  const overallRate = totals.target > 0 ? totals.complete / totals.target : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="スタッシュ"
        subtitle="タスクごとの集計と継続状況。"
        right={
          <div className="text-right">
            <div className="text-xs text-game-fg-muted">全体の完了率</div>
            <span className="text-lg font-bold text-game-accent">
              {formatCompletionRate(overallRate)}
            </span>
          </div>
        }
      />
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
