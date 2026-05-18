import React from 'react';
import { useTodayTasks } from '../../hooks/useTodayTasks.js';
import { TimeSlotGroup } from './TimeSlotGroup.js';

export interface TodayViewProps {
  today: string;
  /** PageHeader の right スロットに done/total を表示するためのレンダーコールバック */
  onCountsChange?: (doneCount: number, totalDue: number) => void;
}

export function TodayView({ today, onCountsChange }: TodayViewProps): React.ReactElement {
  const groups = useTodayTasks(today);

  // 全グループを横断して done 数と合計タスク数を算出する
  const allTasks = groups.flatMap((g) => g.tasks);
  const totalDue = allTasks.length;
  const doneCount = allTasks.filter((t) => t.status === 'complete').length;

  React.useEffect(() => {
    onCountsChange?.(doneCount, totalDue);
  }, [doneCount, totalDue, onCountsChange]);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        今日のタスクはありません。タスクを追加するか、頻度設定を見直してください。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <TimeSlotGroup key={group.time_slot_id} group={group} today={today} />
      ))}
    </div>
  );
}
