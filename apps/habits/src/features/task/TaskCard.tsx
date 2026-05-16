import type { Frequency } from '@org/habit-core';
import type { Task } from '@org/habit-sync';
import { formatFrequency } from '../../lib/frequency-format.js';

export interface TaskCardProps {
  task: Task;
  timeSlotName: string;
  onEdit: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  onUnarchive: (taskId: string) => void;
}

export function TaskCard({
  task,
  timeSlotName,
  onEdit,
  onArchive,
  onUnarchive,
}: TaskCardProps): React.ReactElement {
  const isArchived = task.archived_at !== null;
  const freq = task.frequency as unknown as Frequency;
  return (
    <li
      className={`flex items-center gap-3 rounded border border-gray-700 p-3 ${
        isArchived ? 'opacity-60' : ''
      }`}
    >
      <div className="flex-1 space-y-1">
        <div className="text-sm font-medium">{task.name}</div>
        <div className="text-xs text-gray-400">
          {timeSlotName} ／ {formatFrequency(freq)}
        </div>
      </div>
      {isArchived ? (
        <button
          type="button"
          onClick={() => onUnarchive(task.id)}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          復元
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onEdit(task.id)}
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            編集
          </button>
          <button
            type="button"
            onClick={() => onArchive(task.id)}
            className="rounded border border-gray-500 px-3 py-1 text-sm"
          >
            アーカイブ
          </button>
        </>
      )}
    </li>
  );
}
