import { use$ } from '@legendapp/state/react';
import { state$, type Task } from '@org/habit-sync';
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
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-400">タスク選択</span>
        <select
          aria-label="タスク選択"
          className="rounded border border-gray-500 bg-transparent px-2 py-1"
          value={selectedId ?? ''}
          onChange={(e) => {
            setSelectedId(e.target.value);
          }}
        >
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

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
        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            void loadMore();
          }}
          className="rounded border border-gray-500 px-3 py-1 text-sm disabled:opacity-50"
        >
          {isLoading ? '読み込み中...' : 'もっと読み込む'}
        </button>
      ) : (
        <p className="text-xs text-gray-500">これ以上履歴はありません。</p>
      )}
    </div>
  );
}
