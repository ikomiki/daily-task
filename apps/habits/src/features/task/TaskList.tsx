import { useValue } from '@legendapp/state/react';
import { archiveTask, state$, unarchiveTask } from '@org/habit-sync';
import { useState } from 'react';
import { TaskCard } from './TaskCard.js';

export interface TaskListProps {
  onEdit: (taskId: string) => void;
}

export function TaskList({ onEdit }: TaskListProps): React.ReactElement {
  const [showArchived, setShowArchived] = useState(false);

  const { active, archived, slotNameById } = useValue(() => {
    const tasks = Object.values(state$.tasks.get());
    const slots = state$.time_slots.get();
    const slotName: Record<string, string> = {};
    for (const s of Object.values(slots)) {
      slotName[s.id] = s.name;
    }
    const sorted = [...tasks].sort((a, b) => a.sort_order - b.sort_order);
    return {
      active: sorted.filter((t) => t.archived_at === null),
      archived: sorted.filter((t) => t.archived_at !== null),
      slotNameById: slotName,
    };
  });

  if (active.length === 0 && archived.length === 0) {
    return (
      <p className="text-sm text-gray-400">タスクが登録されていません。新規追加してください。</p>
    );
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              timeSlotName={slotNameById[t.time_slot_id] ?? '不明'}
              onEdit={onEdit}
              onArchive={archiveTask}
              onUnarchive={unarchiveTask}
            />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            className="text-sm text-game-fg-muted underline underline-offset-[3px]"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived
              ? `アーカイブ済を隠す (${archived.length})`
              : `アーカイブ済を表示 (${archived.length})`}
          </button>
          {showArchived && (
            <ul className="space-y-2">
              {archived.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  timeSlotName={slotNameById[t.time_slot_id] ?? '不明'}
                  onEdit={onEdit}
                  onArchive={archiveTask}
                  onUnarchive={unarchiveTask}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
