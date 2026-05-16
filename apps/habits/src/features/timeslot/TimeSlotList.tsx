import { use$ } from '@legendapp/state/react';
import { createTimeSlot, deleteTimeSlot, state$, updateTimeSlot } from '@org/habit-sync';
import { useState } from 'react';
import { TimeSlotEditor, type TimeSlotEditorValues } from './TimeSlotEditor.js';

type Mode = { type: 'list' } | { type: 'new' } | { type: 'edit'; id: string };

// 'HH:MM:SS' → 'HH:MM' に変換（表示用）
function trimSeconds(s: string): string {
  return s.slice(0, 5);
}

export function TimeSlotList(): React.ReactElement {
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const slots = use$(() => {
    return Object.values(state$.time_slots.get()).sort((a, b) => a.sort_order - b.sort_order);
  });

  const handleCreate = (values: TimeSlotEditorValues): void => {
    const maxOrder = Math.max(-1, ...slots.map((s) => s.sort_order));
    createTimeSlot({ ...values, sort_order: maxOrder + 1 });
    setMode({ type: 'list' });
    setErrorMessage(null);
  };

  const handleUpdate = (id: string, values: TimeSlotEditorValues): void => {
    updateTimeSlot(id, values);
    setMode({ type: 'list' });
    setErrorMessage(null);
  };

  const handleDelete = (id: string): void => {
    setErrorMessage(null);
    const result = deleteTimeSlot(id);
    if (!result.ok) {
      setErrorMessage(result.reason);
    }
  };

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {slots.map((s) =>
          mode.type === 'edit' && mode.id === s.id ? (
            <li key={s.id}>
              <TimeSlotEditor
                initial={{ name: s.name, notify_at: s.notify_at }}
                onSubmit={(values) => handleUpdate(s.id, values)}
                onCancel={() => setMode({ type: 'list' })}
                submitLabel="保存"
              />
            </li>
          ) : (
            <li key={s.id} className="flex items-center gap-3 rounded border border-gray-700 p-3">
              <div className="flex-1 space-y-1">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-gray-400">{trimSeconds(s.notify_at)}</div>
              </div>
              <button
                type="button"
                onClick={() => setMode({ type: 'edit', id: s.id })}
                className="rounded border border-gray-500 px-3 py-1 text-sm"
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                className="rounded border border-red-500 px-3 py-1 text-sm text-red-400"
              >
                削除
              </button>
            </li>
          ),
        )}
      </ul>

      {errorMessage !== null && (
        <p role="alert" className="text-sm text-red-400">
          {errorMessage}
        </p>
      )}

      {mode.type === 'new' ? (
        <TimeSlotEditor
          onSubmit={handleCreate}
          onCancel={() => setMode({ type: 'list' })}
          submitLabel="作成"
        />
      ) : (
        <button
          type="button"
          onClick={() => setMode({ type: 'new' })}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          時間帯を追加
        </button>
      )}
    </div>
  );
}
