import type React from 'react';
import { useTodayTasks } from '../../hooks/useTodayTasks.js';
import { TimeSlotGroup } from './TimeSlotGroup.js';

export interface TodayViewProps {
  today: string;
}

export function TodayView({ today }: TodayViewProps): React.ReactElement {
  const groups = useTodayTasks(today);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        今日のタスクはありません。タスクを追加するか、頻度設定を見直してください。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <TimeSlotGroup key={group.time_slot_id} group={group} today={today} />
      ))}
    </div>
  );
}
