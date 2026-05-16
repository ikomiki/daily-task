// 'YYYY-MM-DD' 文字列を UTC エポックからの日数（整数）に変換する。
// タイムゾーン非依存にするため、Date.UTC を使う。
export function toUtcDays(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

// ISO 曜日番号: 1=月, 2=火, ..., 7=日（PostgreSQL の EXTRACT(ISODOW) と一致）
export function isoDayOfWeek(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  const jsDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=日..6=土
  return ((jsDow + 6) % 7) + 1;
}

// 月内週数: その月の同曜日が何回目か（SQL の (day - 1) / 7 + 1 と一致）
export function weekOfMonth(yyyyMmDd: string): number {
  const day = Number.parseInt(yyyyMmDd.slice(8, 10), 10);
  return Math.floor((day - 1) / 7) + 1;
}
