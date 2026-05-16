// task_stash_view の各カラムは number | null（LEFT JOIN）。UI 表示用フォーマッタ。

export function formatStashCount(value: number | null): string {
  return String(value ?? 0);
}

// completion_rate は 0.0–1.0 の比率。null は分母 0（task_days = 0）を意味する。
export function formatCompletionRate(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

export function formatLastCompletedDate(value: string | null): string {
  if (value === null) {
    return '—';
  }
  return value;
}
