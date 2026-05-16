import type { DisplayTaskStatus, TaskStatus } from '@org/habit-sync';
import type React from 'react';

export interface StatusButtonsProps {
  current: DisplayTaskStatus;
  onChange: (next: TaskStatus | null) => void;
}

// 3 状態の切り替えボタン設定
const STATUS_OPTIONS: ReadonlyArray<{ value: TaskStatus; label: string; activeClass: string }> = [
  { value: 'complete', label: '完了', activeClass: 'bg-green-600 text-white' },
  { value: 'skip', label: 'スキップ', activeClass: 'bg-yellow-600 text-white' },
  { value: 'fail', label: '失敗', activeClass: 'bg-red-600 text-white' },
];

const INACTIVE_CLASS = 'bg-transparent text-game-fg border-gray-500';

// 3 状態の切り替えボタン。
// - 現在の status をクリックすると null（empty）に戻す
// - 別の status をクリックすると切り替え
export function StatusButtons({ current, onChange }: StatusButtonsProps): React.ReactElement {
  return (
    <div role="group" className="flex gap-2">
      {STATUS_OPTIONS.map((opt) => {
        const isActive = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              onChange(isActive ? null : opt.value);
            }}
            className={`rounded border px-3 py-1 text-sm ${isActive ? opt.activeClass : INACTIVE_CLASS}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
