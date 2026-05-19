import { use$ } from '@legendapp/state/react';
import { state$, type Task } from '@org/habit-sync';
import { Button, SelectInput } from '@org/ui';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useTaskHistory } from '../../hooks/useTaskHistory.js';
import { formatHistoryStatus } from '../../lib/history-status.js';

// ステータスに対応するドットの色クラスマッピング
const STATUS_DOT_COLOR: Record<string, string> = {
  complete: 'bg-status-complete',
  skip: 'bg-status-skip',
  fail: 'bg-status-fail',
};

// タスクは active/archived を区別せず、name 昇順で全部選択肢に出す。
// 履歴閲覧の用途上、アーカイブ済タスクも参照できるのが自然なため。
function useAllTasksForHistory(): Task[] {
  return use$(() => {
    const list = Object.values(state$.tasks.get()) as Task[];
    return list.slice().sort((a, b) => a.name.localeCompare(b.name));
  });
}

export function HistoryView(): React.ReactElement {
  const tasks = useAllTasksForHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // タスク一覧が入ったとき、未選択なら先頭を選ぶ
  useEffect(() => {
    if (selectedId === null && tasks.length > 0) {
      setSelectedId(tasks[0].id);
    }
  }, [tasks, selectedId]);

  const { logs, hasMore, isLoading, loadMore } = useTaskHistory(selectedId);

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-game-fg-dim">
        タスクが登録されていません。先にタスクを追加してください。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SelectInput
        aria-label="タスク選択"
        label="タスク選択"
        className="max-w-[340px]"
        value={selectedId ?? ''}
        onChange={(e) => {
          setSelectedId(e.target.value);
        }}
        options={tasks.map((t) => ({ value: t.id, label: t.name }))}
      />

      {logs.length === 0 ? (
        <p className="text-sm text-game-fg-dim">このタスクには履歴がありません。</p>
      ) : (
        <ul>
          {logs.map((l) => {
            const dotColor = STATUS_DOT_COLOR[l.status] ?? 'bg-game-fg-dim';
            return (
              <li
                key={`${l.task_id}-${l.date}`}
                data-testid="history-entry"
                className="flex items-baseline justify-between py-2.5 border-t border-border-default"
              >
                <span className="font-mono tabular-nums text-sm">{l.date}</span>
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
                  <span className="text-game-fg-muted">{formatHistoryStatus(l.status)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore ? (
        <Button
          variant="secondary"
          type="button"
          disabled={isLoading}
          onClick={() => {
            void loadMore();
          }}
        >
          {isLoading ? '読み込み中...' : 'もっと読み込む'}
        </Button>
      ) : (
        <p className="text-xs text-game-fg-dim">これ以上履歴はありません。</p>
      )}
    </div>
  );
}
