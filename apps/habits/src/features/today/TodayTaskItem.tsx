import {
  clearTaskLogStatus,
  setTaskLogStatus,
  type TodayTaskItem as TodayTaskItemModel,
} from '@org/habit-sync';
import type React from 'react';
import { StatusButtons } from './StatusButtons.js';

export interface TodayTaskItemProps {
  item: TodayTaskItemModel;
  today: string;
}

// タスク 1 行を描画するコンポーネント。タスク名 + StatusButtons を表示し、
// ボタン押下で state$.task_logs を楽観更新する。
export function TodayTaskItem({ item, today }: TodayTaskItemProps): React.ReactElement {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="flex-1 text-sm">{item.name}</span>
      <StatusButtons
        current={item.status}
        onChange={(next) => {
          if (next === null) {
            clearTaskLogStatus(item.id, today);
          } else {
            setTaskLogStatus(item.id, today, next);
          }
        }}
      />
    </li>
  );
}
