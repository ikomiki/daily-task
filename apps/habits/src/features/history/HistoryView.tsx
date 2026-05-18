import { use$ } from '@legendapp/state/react';
import { state$, type Task } from '@org/habit-sync';
import { Button, SelectInput } from '@org/ui';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useTaskHistory } from '../../hooks/useTaskHistory.js';
import { formatHistoryStatus } from '../../lib/history-status.js';

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
      <p className="text-sm text-gray-400">
        タスクが登録されていません。先にタスクを追加してください。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SelectInput
        aria-label="タスク選択"
        label="タスク選択"
        value={selectedId ?? ''}
        onChange={(e) => {
          setSelectedId(e.target.value);
        }}
        options={tasks.map((t) => ({ value: t.id, label: t.name }))}
      />

      {logs.length === 0 ? (
        <p className="text-sm text-gray-400">このタスクには履歴がありません。</p>
      ) : (
        <ul className="divide-y divide-gray-700">
          {logs.map((l) => (
            <li
              key={`${l.task_id}-${l.date}`}
              data-testid="history-entry"
              className="flex items-baseline justify-between py-2"
            >
              <span className="text-sm">{l.date}</span>
              <span className="text-sm text-gray-300">{formatHistoryStatus(l.status)}</span>
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <Button
          type="button"
          disabled={isLoading}
          onClick={() => {
            void loadMore();
          }}
        >
          {isLoading ? '読み込み中...' : 'もっと読み込む'}
        </Button>
      ) : (
        <p className="text-xs text-gray-500">これ以上履歴はありません。</p>
      )}
    </div>
  );
}
