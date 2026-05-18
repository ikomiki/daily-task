import { AlertText, Button, TextInput } from '@org/ui';
import { type FormEvent, useState } from 'react';

export interface TimeSlotEditorValues {
  name: string;
  notify_at: string; // 'HH:MM:SS'
}

export interface TimeSlotEditorProps {
  initial?: TimeSlotEditorValues;
  onSubmit: (values: TimeSlotEditorValues) => void;
  onCancel: () => void;
  submitLabel: string;
}

// 'HH:MM:SS' → 'HH:MM' に変換（input[type=time] の value 形式）
function trimSeconds(s: string): string {
  return s.slice(0, 5);
}

// 'HH:MM' → 'HH:MM:SS' に補完（DB の time 型形式）
function withSeconds(s: string): string {
  return s.length === 5 ? `${s}:00` : s;
}

export function TimeSlotEditor({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: TimeSlotEditorProps): React.ReactElement {
  const [name, setName] = useState(initial?.name ?? '');
  const [notifyAt, setNotifyAt] = useState(trimSeconds(initial?.notify_at ?? '07:00:00'));
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (name.trim() === '') {
      setValidationError('時間帯名を入力してください。');
      return;
    }
    setValidationError(null);
    onSubmit({ name: name.trim(), notify_at: withSeconds(notifyAt) });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-3 rounded border border-gray-600 p-3"
    >
      <TextInput
        type="text"
        label="時間帯名"
        aria-label="時間帯名"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextInput
        type="time"
        label="通知時刻"
        aria-label="通知時刻"
        value={notifyAt}
        onChange={(e) => setNotifyAt(e.target.value)}
      />
      {validationError !== null && <AlertText>{validationError}</AlertText>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm">
          {submitLabel}
        </Button>
        <Button type="button" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}
