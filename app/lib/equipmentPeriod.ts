// Shared helpers so that past-period reports/inspections only count masterlist
// equipment that actually existed during that period. Equipment added to the
// masterlist after a period must not make that period's "uninspected" count grow.

/**
 * Compute the end of the selected period (inclusive, end-of-day).
 * - monthYear: "MM/YYYY" (e.g. "03/2026")
 * - week: optional "Week N" (N = 1..4). Week N covers days (N-1)*7+1 .. min(N*7, lastDay).
 * - availableWeeks: optional sorted list of weeks that actually have inspection data for the
 *   month. When a specific `week` is not given but available weeks exist (i.e. "All Weeks" is
 *   active), the period ends at the latest available week so equipment added after the last
 *   inspected week is not counted as uninspected.
 * Returns null when no valid month is given.
 */
export function getPeriodEndDate(
  monthYear: string,
  week?: string,
  availableWeeks?: string[]
): Date | null {
  if (!monthYear) return null;
  const [mm, yyyy] = monthYear.split('/');
  const monthNum = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (!mm || isNaN(monthNum) || isNaN(year)) return null;

  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getDate();
  let endDay = lastDay;
  const resolvedWeek = week || (availableWeeks && availableWeeks.length > 0 ? availableWeeks[availableWeeks.length - 1] : undefined);
  if (resolvedWeek) {
    const weekNum = parseInt(resolvedWeek.replace(/[^0-9]/g, ''), 10) || 1;
    // The inspection form caps weeks at 4 (all days 22+ fall into "Week 4"),
    // so the last week always ends on the final day of the month.
    endDay = weekNum >= 4 ? lastDay : Math.min(weekNum * 7, lastDay);
  }
  return new Date(Date.UTC(year, monthNum - 1, endDay, 23, 59, 59, 999));
}

/**
 * Whether an equipment row existed on or before the end of the selected period.
 * Uses the masterlist creation date (`created_at`) falling back to `start_date`.
 * Rows without any date are always included (legacy data).
 */
export function equipmentExistsInPeriod(
  equipment: { created_at?: string | null; start_date?: string | null },
  periodEnd: Date | null
): boolean {
  if (!periodEnd) return true;
  const dateStr = equipment.created_at || equipment.start_date || null;
  if (!dateStr) return true;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return true;
  return date.getTime() <= periodEnd.getTime();
}