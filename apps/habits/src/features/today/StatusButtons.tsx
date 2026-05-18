import type { DisplayTaskStatus, TaskStatus } from '@org/habit-sync';
import type React from 'react';

export interface StatusButtonsProps {
  current: DisplayTaskStatus;
  onChange: (next: TaskStatus | null) => void;
}

// 3 状態の切り替えボタン設定
const STATUS_OPTIONS: ReadonlyArray<{ value: TaskStatus; label: string; activeClass: string }> = [
  {
    value: 'complete',
    label: '完了',
    activeClass: 'bg-status-complete border-transparent text-white',
  },
  { value: 'skip', label: 'スキップ', activeClass: 'bg-status-skip border-transparent text-white' },
  { value: 'fail', label: '失敗', activeClass: 'bg-status-fail border-transparent text-white' },
];

const INACTIVE_CLASS =
  'border border-border-strong px-2.5 py-1 text-xs rounded-md hover:bg-surface-2';

// 3 状態の切り替えボタン。
// - 現在の status をクリックすると null（empty）に戻す
// - 別の status をクリックすると切り替え
export function StatusButtons({ current, onChange }: StatusButtonsProps): React.ReactElement {
  return (
    <div className="inline-flex gap-1.5">
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
            className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs transition-colors ${isActive ? opt.activeClass : INACTIVE_CLASS}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
