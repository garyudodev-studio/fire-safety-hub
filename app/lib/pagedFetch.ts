import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch ALL rows from a table, bypassing PostgREST's default 1000-row limit.
 * Without this, once `inspections` grows past 1000 rows the oldest records are
 * silently dropped from the response — which made already-inspected equipment
 * (e.g. 08/2026 Week 1 Fire Extinguishers) reappear as "Not Inspected".
 */
export async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  orderColumn = 'created_at',
  ascending = false,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderColumn, { ascending })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
