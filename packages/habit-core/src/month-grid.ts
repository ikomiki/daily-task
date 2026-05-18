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
