import type { Frequency } from '@org/habit-core';

export interface FrequencyPickerProps {
  value: Frequency;
  onChange: (next: Frequency) => void;
}

const TYPE_OPTIONS: ReadonlyArray<{ value: Frequency['type']; label: string }> = [
  { value: 'daily', label: '毎日' },
  { value: 'every_n_days', label: 'N 日ごと' },
  { value: 'weekday', label: '曜日指定' },
  { value: 'day_of_week', label: '曜日 + 第 n 週' },
  { value: 'every_n_weeks', label: 'N 週ごと' },
];

const WEEKDAY_LABELS: ReadonlyArray<{ iso: number; label: string }> = [
  { iso: 1, label: '月' },
  { iso: 2, label: '火' },
  { iso: 3, label: '水' },
  { iso: 4, label: '木' },
  { iso: 5, label: '金' },
  { iso: 6, label: '土' },
  { iso: 7, label: '日' },
];

const WEEKS_OF_MONTH = [1, 2, 3, 4, 5] as const;

// 今日の日付を YYYY-MM-DD 形式で返す。
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// type に応じたデフォルト Frequency を返す。
function defaultForType(type: Frequency['type']): Frequency {
  switch (type) {
    case 'daily':
      return { type: 'daily' };
    case 'every_n_days':
      return { type: 'every_n_days', n: 1, anchor: todayString() };
    case 'weekday':
      return { type: 'weekday', days: [1, 2, 3, 4, 5] };
    case 'day_of_week':
      return { type: 'day_of_week', days: [1] };
    case 'every_n_weeks':
      return { type: 'every_n_weeks', n: 1, day_of_week: 1, anchor: todayString() };
  }
}

// days 配列から iso 曜日を toggle する（追加 or 削除）。
function toggleDay(days: ReadonlyArray<number>, iso: number): number[] {
  return days.includes(iso) ? days.filter((d) => d !== iso) : [...days, iso].sort((a, b) => a - b);
}

export function FrequencyPicker({ value, onChange }: FrequencyPickerProps): React.ReactElement {
  return (
    <div className="space-y-3">
      {/* 頻度タイプ選択 */}
      <label className="block space-y-1">
        <span className="text-sm font-medium">頻度の種類</span>
        <select
          aria-label="頻度の種類"
          value={value.type}
          onChange={(e) => {
            onChange(defaultForType(e.target.value as Frequency['type']));
          }}
          className="block w-full rounded border border-gray-500 bg-transparent px-2 py-1"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* every_n_days: n と anchor */}
      {value.type === 'every_n_days' && (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-sm">n（日数）</span>
            <input
              aria-label="n（日数）"
              type="number"
              min="1"
              value={value.n}
              onChange={(e) => {
                const n = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                onChange({ ...value, n });
              }}
              className="block w-32 rounded border border-gray-500 bg-transparent px-2 py-1"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">開始日</span>
            <input
              aria-label="開始日"
              type="date"
              value={value.anchor}
              onChange={(e) => {
                onChange({ ...value, anchor: e.target.value });
              }}
              className="block rounded border border-gray-500 bg-transparent px-2 py-1"
            />
          </label>
        </div>
      )}

      {/* weekday / day_of_week: 曜日チェックボックス */}
      {(value.type === 'weekday' || value.type === 'day_of_week') && (
        <fieldset className="space-y-2">
          <legend className="text-sm">曜日</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map(({ iso, label }) => (
              <label key={iso} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={value.days.includes(iso)}
                  onChange={() => {
                    onChange({ ...value, days: toggleDay(value.days, iso) });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* day_of_week: 第 n 週チェックボックス */}
      {value.type === 'day_of_week' && (
        <fieldset className="space-y-2">
          <legend className="text-sm">第 n 週（未指定なら毎週）</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKS_OF_MONTH.map((w) => {
              // value が day_of_week に narrowed されている状態でローカル変数に確定させる。
              const dayOfWeekValue = value;
              const checked = dayOfWeekValue.weeks_of_month?.includes(w) ?? false;
              return (
                <label key={w} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    aria-label={`第 ${w} 週`}
                    checked={checked}
                    onChange={() => {
                      const current = dayOfWeekValue.weeks_of_month ?? [];
                      const next = current.includes(w)
                        ? current.filter((x) => x !== w)
                        : [...current, w].sort((a, b) => a - b);
                      // weeks_of_month が空の場合は undefined として省略する（optional フィールド）。
                      if (next.length === 0) {
                        onChange({ type: 'day_of_week', days: dayOfWeekValue.days });
                      } else {
                        onChange({
                          type: 'day_of_week',
                          days: dayOfWeekValue.days,
                          weeks_of_month: next,
                        });
                      }
                    }}
                  />
                  第 {w} 週
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* every_n_weeks: n / 曜日 select / anchor */}
      {value.type === 'every_n_weeks' && (
        <div className="space-y-2">
          <label className="block space-y-1">
            <span className="text-sm">n（週数）</span>
            <input
              aria-label="n（週数）"
              type="number"
              min="1"
              value={value.n}
              onChange={(e) => {
                const n = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                onChange({ ...value, n });
              }}
              className="block w-32 rounded border border-gray-500 bg-transparent px-2 py-1"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">曜日</span>
            <select
              aria-label="曜日"
              value={String(value.day_of_week)}
              onChange={(e) => {
                onChange({ ...value, day_of_week: Number.parseInt(e.target.value, 10) });
              }}
              className="block w-32 rounded border border-gray-500 bg-transparent px-2 py-1"
            >
              {WEEKDAY_LABELS.map(({ iso, label }) => (
                <option key={iso} value={iso}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm">開始日</span>
            <input
              aria-label="開始日"
              type="date"
              value={value.anchor}
              onChange={(e) => {
                onChange({ ...value, anchor: e.target.value });
              }}
              className="block rounded border border-gray-500 bg-transparent px-2 py-1"
            />
          </label>
        </div>
      )}
    </div>
  );
}
