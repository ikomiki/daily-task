import { Card } from '@org/ui';
import type React from 'react';
import type { TaskStashRow } from '../../hooks/useTaskStashList.js';
import {
  formatCompletionRate,
  formatLastCompletedDate,
  formatStashCount,
} from '../../lib/stash-format.js';

export interface StashRowProps {
  row: TaskStashRow;
}

// 1 タスクの集計 1 行を表示。レスポンシブのため、md 未満は折り返す。
export function StashRow({ row }: StashRowProps): React.ReactElement {
  return (
    <Card className="space-y-2 bg-gray-900/40">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{row.task_name}</h3>
        <span className="text-xs text-gray-400">{row.slot_name}</span>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4">
        <div>
          <dt className="text-gray-400">完了</dt>
          <dd>{formatStashCount(row.complete_count)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">スキップ</dt>
          <dd>{formatStashCount(row.skip_count)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">失敗</dt>
          <dd>{formatStashCount(row.fail_count)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">連続</dt>
          <dd>{formatStashCount(row.current_streak)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">対象日数</dt>
          <dd>{formatStashCount(row.task_days)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">完了率</dt>
          <dd>{formatCompletionRate(row.completion_rate)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-gray-400">最終完了</dt>
          <dd>{formatLastCompletedDate(row.last_completed_date)}</dd>
        </div>
      </dl>
    </Card>
  );
}
