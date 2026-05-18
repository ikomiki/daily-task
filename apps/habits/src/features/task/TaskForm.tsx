import type { Frequency } from '@org/habit-core';
import type { TimeSlot } from '@org/habit-sync';
import { AlertText, Button, SelectInput, TextInput } from '@org/ui';
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
  onCancel?: () => void;
  submitLabel: string;
}

export function TaskForm({
  timeSlots,
  initial,
  onSubmit,
  onCancel,
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
      <TextInput
        aria-label="タスク名"
        label="タスク名"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {/* 時間帯選択 */}
      <SelectInput
        aria-label="時間帯"
        label="時間帯"
        value={timeSlotId}
        onChange={(e) => setTimeSlotId(e.target.value)}
        disabled={noSlots}
        options={timeSlots.map((s) => ({ value: s.id, label: s.name }))}
      />

      {/* 頻度設定 */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">頻度</legend>
        <FrequencyPicker value={frequency} onChange={setFrequency} />
      </fieldset>

      {/* 時間帯未登録の警告 */}
      {noSlots && (
        <AlertText>
          時間帯が登録されていません。先に「設定 → 時間帯」で 1 件以上作成してください。
        </AlertText>
      )}
      {/* バリデーションエラー */}
      {validationError !== null && <AlertText>{validationError}</AlertText>}

      <div className="flex justify-end gap-2">
        {onCancel !== undefined && (
          <Button type="button" onClick={onCancel}>
            キャンセル
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={noSlots}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
