// 端末ローカル時刻から 'YYYY-MM-DD' 文字列を返す。
// 引数 now は主にテスト用。本番では new Date() が使われる。
export function getTodayDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
