/**
 * Date utility functions tuned for Indonesia time (Asia/Jakarta, WIB, UTC+7).
 */

/**
 * Returns current date or provided date as "YYYY-MM-DD" string in Indonesia timezone (Asia/Jakarta).
 */
export function getIndoDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Returns current month/year or provided date as "MM/YYYY" string in Indonesia timezone (Asia/Jakarta).
 */
export function getIndoMonthYear(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${month}/${year}`;
}

/**
 * Calculates Week (Week 1 to Week 4) and Month/Year (MM/YYYY) from a YYYY-MM-DD date string.
 */
export function getWeekAndMonthYearFromDate(dateStr: string): { week: string; monthYear: string } {
  if (!dateStr) return { week: 'Week 1', monthYear: '' };
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return { week: 'Week 1', monthYear: '' };
  const [yyyy, mm, dd] = parts;
  const dayNum = parseInt(dd, 10);
  const weekNum = Math.min(4, Math.ceil(dayNum / 7));
  return {
    week: `Week ${weekNum}`,
    monthYear: `${mm}/${yyyy}`,
  };
}

/**
 * Formats a Date or timestamp to local Indonesia date/time string (WIB, Asia/Jakarta).
 */
export function formatIndoDateTime(dateStrOrObj?: string | Date | null): string {
  if (!dateStrOrObj) return '-';
  const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}
