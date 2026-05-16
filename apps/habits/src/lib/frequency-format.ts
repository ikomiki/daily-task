import type { Frequency } from '@org/habit-core';

// ISO 曜日番号（1=月..7=日）から日本語ラベルへのマッピング
const DAY_LABEL_BY_ISO: Record<number, string> = {
  1: '月',
  2: '火',
  3: '水',
  4: '木',
  5: '金',
  6: '土',
  7: '日',
};

// 曜日番号の配列を日本語ラベルの連結文字列に変換する。
// 空配列の場合は「なし」を返す。
function formatDays(days: ReadonlyArray<number>): string {
  if (days.length === 0) {
    return 'なし';
  }
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABEL_BY_ISO[d] ?? '?')
    .join('');
}

// Frequency を日本語の短いサマリ文字列に整形する。
// 例: 'daily' → '毎日'、'every_n_days' → '3 日ごと（開始: 2026-05-01）'
export function formatFrequency(freq: Frequency): string {
  if (freq.type === 'daily') {
    return '毎日';
  }
  if (freq.type === 'every_n_days') {
    return `${freq.n} 日ごと（開始: ${freq.anchor}）`;
  }
  if (freq.type === 'weekday') {
    return formatDays(freq.days);
  }
  if (freq.type === 'day_of_week') {
    const dayLabel = formatDays(freq.days);
    // 複数曜日の場合は「曜」を付けない（例: 「月水金」）。
    // 単一曜日の場合は「曜」を付ける（例: 「木曜」）。
    const suffix = freq.days.length === 1 ? '曜' : '';
    if (freq.weeks_of_month === undefined) {
      return `毎週${dayLabel}${suffix}`;
    }
    const weeks = [...freq.weeks_of_month].sort((a, b) => a - b).join('/');
    return `第 ${weeks} ${dayLabel}${suffix}`;
  }
  if (freq.type === 'every_n_weeks') {
    const dow = DAY_LABEL_BY_ISO[freq.day_of_week] ?? '?';
    return `${freq.n} 週ごと${dow}曜（開始: ${freq.anchor}）`;
  }
  return '?';
}
