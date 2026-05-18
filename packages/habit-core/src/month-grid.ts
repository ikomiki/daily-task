import { isoDayOfWeek } from './dates.js';

// 'YYYY-MM-DD' の月初を返す。
export function startOfMonth(yyyyMmDd: string): string {
  return `${yyyyMmDd.slice(0, 7)}-01`;
}

// 'YYYY-MM-DD' の月末を返す（Date.UTC は year, month=0..11, day=0 が前月末日）。
export function endOfMonth(yyyyMmDd: string): string {
  const [y, m] = yyyyMmDd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${yyyyMmDd.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

// 月加減算後の月初を返す（日成分は捨てる）。
export function addMonths(yyyyMmDd: string, n: number): string {
  const [y, m] = yyyyMmDd.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + n;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${String(newYear).padStart(4, '0')}-${String(newMonth).padStart(2, '0')}-01`;
}

// 'YYYY-MM' を入力に取り、6 週 × 7 列 = 42 個の 'YYYY-MM-DD' 配列を返す。
// 日曜始まり。前月末日と翌月先頭日でオーバーラップを埋める。
export function buildCalendarGrid(yearMonth: string): string[] {
  const firstOfMonth = `${yearMonth}-01`;
  // 日曜始まりオフセット: 日=0, 月=1, ..., 土=6
  // isoDayOfWeek は 1=月..7=日 なので、日=7→0、他はそのまま
  const iso = isoDayOfWeek(firstOfMonth);
  const sundayOffset = iso === 7 ? 0 : iso;
  const [y, m] = firstOfMonth.split('-').map(Number);
  const startMs = Date.UTC(y, m - 1, 1 - sundayOffset);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startMs + i * 86_400_000);
    const yy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    cells.push(`${yy}-${mm}-${dd}`);
  }
  return cells;
}
