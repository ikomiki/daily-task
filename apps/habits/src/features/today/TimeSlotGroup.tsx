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
  return (
    <section className="space-y-2">
      <header className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold text-game-accent">{group.slot_name}</h2>
        <span className="text-sm text-gray-400">{formatTime(group.notify_at)}</span>
      </header>
      {group.tasks.length === 0 ? (
        <p className="text-sm text-gray-400">タスクなし</p>
      ) : (
        <ul className="divide-y divide-gray-700">
          {group.tasks.map((item) => (
            <TodayTaskItem key={item.id} item={item} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}
