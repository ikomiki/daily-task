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
  // 進捗バー用の幅計算（合計が 100% を超えないようにクランプ）
  const total = row.task_days ?? 0;
  const complete = row.complete_count ?? 0;
  const skip = row.skip_count ?? 0;
  const fail = row.fail_count ?? 0;

  const completeW = total > 0 ? Math.min((complete / total) * 100, 100) : 0;
  const skipW = total > 0 ? Math.min((skip / total) * 100, 100 - completeW) : 0;
  const failW = total > 0 ? Math.min((fail / total) * 100, 100 - completeW - skipW) : 0;

  const streak = row.current_streak ?? 0;

  return (
    <Card className="bg-surface-2 px-4 py-4">
      {/* ヘッダー行: タスク名 + メタ情報 / ストリークバッジ */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium">{row.task_name}</div>
          <div className="mt-0.5 text-xs text-game-fg-muted">{row.slot_name}</div>
        </div>
        {streak > 0 && (
          <span className="shrink-0 rounded-full bg-game-accent/14 px-2 py-0.5 text-xs font-semibold tabular-nums text-game-accent">
            🔥 {streak} 日連続
          </span>
        )}
      </div>

      {/* 集計グリッド */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4">
        <div>
          <dt className="text-xs text-game-fg-muted">完了</dt>
          <dd className="font-semibold tabular-nums text-status-complete">
            {formatStashCount(row.complete_count)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-game-fg-muted">スキップ</dt>
          <dd className="font-semibold tabular-nums text-status-skip">
            {formatStashCount(row.skip_count)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-game-fg-muted">失敗</dt>
          <dd className="font-semibold tabular-nums text-status-fail">
            {formatStashCount(row.fail_count)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-game-fg-muted">連続</dt>
          <dd className="font-semibold tabular-nums text-game-fg">
            {formatStashCount(row.current_streak)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-game-fg-muted">対象日数</dt>
          <dd className="font-semibold tabular-nums text-game-fg">
            {formatStashCount(row.task_days)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-game-fg-muted">完了率</dt>
          <dd className="font-semibold tabular-nums text-game-fg">
            {formatCompletionRate(row.completion_rate)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-game-fg-muted">最終完了日</dt>
          <dd className="font-semibold tabular-nums text-game-fg">
            {formatLastCompletedDate(row.last_completed_date)}
          </dd>
        </div>
      </dl>

      {/* 進捗バー（3色セグメント: 完了 / スキップ / 失敗） */}
      {total > 0 && (
        <div
          aria-hidden="true"
          className="mt-3 flex h-1 overflow-hidden rounded-full bg-border-default"
        >
          <div className="bg-status-complete" style={{ width: `${completeW}%` }} />
          <div className="bg-status-skip" style={{ width: `${skipW}%` }} />
          <div className="bg-status-fail" style={{ width: `${failW}%` }} />
        </div>
      )}
    </Card>
  );
}
