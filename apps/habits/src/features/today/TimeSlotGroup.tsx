import type { TodayTaskGroup } from '@org/habit-sync';
import type React from 'react';
import { TodayTaskItem } from './TodayTaskItem.js';

export interface TimeSlotGroupProps {
  group: TodayTaskGroup;
  today: string;
}

// notify_at が 'HH:MM:SS' 形式で渡される（time 型）。表示用に HH:MM に切る。
function formatTime(notifyAt: string): string {
  return notifyAt.slice(0, 5);
}

export function TimeSlotGroup({ group, today }: TimeSlotGroupProps): React.ReactElement {
  // このスロットの完了数を算出する
  const doneCount = group.tasks.filter((t) => t.status === 'complete').length;

  return (
    <section className="rounded-md border border-border-default overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-2 border-b border-border-default">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{group.slot_name}</h2>
          <span className="text-xs text-game-fg-muted font-mono">
            {formatTime(group.notify_at)}
          </span>
        </div>
        <span className="text-xs text-game-fg-muted tabular-nums">
          {doneCount} / {group.tasks.length}
        </span>
      </div>
      {group.tasks.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-400">タスクなし</p>
      ) : (
        <ul>
          {group.tasks.map((item) => (
            <TodayTaskItem key={item.id} item={item} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}
