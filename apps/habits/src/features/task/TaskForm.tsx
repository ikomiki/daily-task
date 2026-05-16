import type { Frequency } from '@org/habit-core';
import type { TimeSlot } from '@org/habit-sync';
import { type FormEvent, useState } from 'react';
import { FrequencyPicker } from './FrequencyPicker.js';

export interface TaskFormValues {
  name: string;
  time_slot_id: string;
  frequency: Frequency;
}

export interface TaskFormProps {
  timeSlots: TimeSlot[];
  initial?: Partial<TaskFormValues>;
  onSubmit: (values: TaskFormValues) => void;
  submitLabel: string;
}

export function TaskForm({
  timeSlots,
  initial,
  onSubmit,
  submitLabel,
}: TaskFormProps): React.ReactElement {
  const [name, setName] = useState(initial?.name ?? '');
  const [timeSlotId, setTimeSlotId] = useState(initial?.time_slot_id ?? timeSlots[0]?.id ?? '');
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? { type: 'daily' });
  const [validationError, setValidationError] = useState<string | null>(null);

  const noSlots = timeSlots.length === 0;

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (name.trim() === '') {
      setValidationError('タスク名を入力してください。');
      return;
    }
    if (timeSlotId === '') {
      setValidationError('時間帯を選択してください。');
      return;
    }
    setValidationError(null);
    onSubmit({ name: name.trim(), time_slot_id: timeSlotId, frequency });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* タスク名入力欄 */}
      <label className="block space-y-1">
        <span className="text-sm font-medium">タスク名</span>
        <input
          aria-label="タスク名"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full rounded border border-gray-500 bg-transparent px-3 py-2"
        />
      </label>

      {/* 時間帯選択 */}
      <label className="block space-y-1">
        <span className="text-sm font-medium">時間帯</span>
        <select
          aria-label="時間帯"
          value={timeSlotId}
          onChange={(e) => setTimeSlotId(e.target.value)}
          disabled={noSlots}
          className="block w-full rounded border border-gray-500 bg-transparent px-3 py-2"
        >
          {timeSlots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {/* 頻度設定 */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">頻度</legend>
        <FrequencyPicker value={frequency} onChange={setFrequency} />
      </fieldset>

      {/* 時間帯未登録の警告 */}
      {noSlots && (
        <p role="alert" className="text-sm text-red-400">
          時間帯が登録されていません。先に「設定 → 時間帯」で 1 件以上作成してください。
        </p>
      )}
      {/* バリデーションエラー */}
      {validationError !== null && (
        <p role="alert" className="text-sm text-red-400">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        disabled={noSlots}
        className="rounded bg-game-accent px-4 py-2 font-medium text-game-bg disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
