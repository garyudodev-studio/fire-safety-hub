'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import InspectionDetailModal, { InspectionRecord } from '@/app/components/inspection/InspectionDetailModal';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'Fire Alarm':         return 'bg-ember-950/60 text-ember-300 border-ember-900/60';
    case 'Fire Hydrant':       return 'bg-sky-950/60 text-sky-300 border-sky-900/60';
    case 'Fire Extinguisher':  return 'bg-orange-950/60 text-orange-300 border-orange-900/60';
    case 'Emergency Lamp':     return 'bg-amber-950/60 text-amber-300 border-amber-900/60';
    case 'Emergency Exit Lamp':return 'bg-emerald-950/60 text-emerald-300 border-emerald-900/60';
    default:                   return 'bg-white/[0.04] text-ink-300 border-line';
  }
}

const TYPE_COLORS: Record<string, string> = {
  'Fire Extinguisher':  '#f97316',
  'Fire Alarm':         '#ef4444',
  'Fire Hydrant':       '#38bdf8',
  'Emergency Lamp':     '#fbbf24',
  'Emergency Exit Lamp':'#34d399',
};

const EQUIPMENT_TYPES = [
  'Fire Extinguisher',
  'Fire Alarm',
  'Fire Hydrant',
  'Emergency Lamp',
  'Emergency Exit Lamp',
];

const PAGE_SIZE = 13;

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color = 'text-ink-100',
  borderColor = '',
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  borderColor?: string;
}) {
  return (
    <div className={`panel p-5 flex flex-col items-center justify-center text-center gap-1 ${borderColor}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</span>
      <span className={`text-4xl font-bold mt-1 ${color}`}>{value}</span>
      {sub && <span className="text-xs text-ink-500 mt-0.5">{sub}</span>}
    </div>
  );
}

function PassRateRing({ rate }: { rate: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  const color = rate >= 80 ? '#34d399' : rate >= 50 ? '#fbbf24' : '#f87171';
  return (
    <div className="panel p-5 flex flex-col items-center justify-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Pass Rate</span>
      <div className="relative flex items-center justify-center">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <circle
            cx="48" cy="48" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)' }}
          />
        </svg>
        <span className="absolute text-xl font-bold" style={{ color }}>{rate}%</span>
      </div>
      <span className="text-xs text-ink-500">Health score</span>
    </div>
  );
}

function TypeBreakdown({ inspections }: { inspections: InspectionRecord[] }) {
  const rows = EQUIPMENT_TYPES.map((t) => {
    const group = inspections.filter((i) => i.equipment_type === t);
    const pass = group.filter((i) => i.status === 'PASS').length;
    const rate = group.length > 0 ? Math.round((pass / group.length) * 100) : null;
    return { type: t, total: group.length, pass, rate };
  }).filter((r) => r.total > 0);

  if (rows.length === 0) return null;
  const maxTotal = Math.max(...rows.map((r) => r.total));

  return (
    <div className="panel p-5 space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Equipment Type Breakdown</h3>
      <div className="space-y-3">
        {rows.map((r) => {
          const col = TYPE_COLORS[r.type] ?? '#8b91a0';
          const barW = maxTotal > 0 ? (r.total / maxTotal) * 100 : 0;
          const passW = r.total > 0 ? (r.pass / r.total) * 100 : 0;
          return (
            <div key={r.type} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-300 font-medium truncate max-w-[160px]">{r.type}</span>
                <span className="text-ink-500 shrink-0 ml-2">
                  {r.pass}/{r.total} &nbsp;
                  {r.rate !== null && (
                    <span style={{ color: col }} className="font-bold">{r.rate}%</span>
                  )}
                </span>
              </div>
              {/* background track */}
              <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
                {/* total width bar */}
                <div
                  className="h-full rounded-full relative overflow-hidden"
                  style={{ width: `${barW}%`, backgroundColor: `${col}30` }}
                >
                  {/* pass fill */}
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                    style={{ width: `${passW}%`, backgroundColor: col }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Pagination({
  total,
  page,
  pageSize,
  onChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  // Show up to 5 page numbers around current
  const pages: (number | '…')[] = [];
  const window = 2;
  let lo = Math.max(1, page - window);
  let hi = Math.min(totalPages, page + window);
  if (lo > 1) { pages.push(1); if (lo > 2) pages.push('…'); }
  for (let i = lo; i <= hi; i++) pages.push(i);
  if (hi < totalPages) { if (hi < totalPages - 1) pages.push('…'); pages.push(totalPages); }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-line bg-ink-950/40">
      <span className="text-xs text-ink-500">
        {total === 0 ? '0 results' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1.5 rounded-lg text-xs text-ink-400 hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ‹ Prev
        </button>
        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`e${idx}`} className="px-1.5 text-ink-600 text-xs">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                p === page
                  ? 'bg-ember-600 text-white'
                  : 'text-ink-400 hover:bg-ink-800'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="px-2.5 py-1.5 rounded-lg text-xs text-ink-400 hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = 'unsafe' | 'safe';

export default function ReportsPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [viewingRecord, setViewingRecord] = useState<InspectionRecord | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Tab & pagination
  const [activeTab, setActiveTab] = useState<TabKey>('unsafe');
  const [unsafePage, setUnsafePage] = useState(1);
  const [safePage, setSafePage] = useState(1);

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { router.push('/'); return; }

    const { data, error } = await supabase
      .from('inspections')
      .select(`*, equipment:equipment_id(location, facility, area)`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInspections(data as InspectionRecord[]);
    }
    setLastFetched(new Date());
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Apply filters ──
  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      const matchSearch =
        item.equipment_no_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.inspector_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.equipment_type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType = selectedType === 'All' || item.equipment_type === selectedType;

      const itemDate = item.inspection_date; // 'YYYY-MM-DD'
      const matchFrom = !dateFrom || itemDate >= dateFrom;
      const matchTo   = !dateTo   || itemDate <= dateTo;

      return matchSearch && matchType && matchFrom && matchTo;
    });
  }, [inspections, searchQuery, selectedType, dateFrom, dateTo]);

  const unsafeRows = useMemo(() => filteredInspections.filter(i => i.status !== 'PASS'), [filteredInspections]);
  const safeRows   = useMemo(() => filteredInspections.filter(i => i.status === 'PASS'),  [filteredInspections]);

  const totalInspections = filteredInspections.length;
  const safeCount   = safeRows.length;
  const unsafeCount = unsafeRows.length;
  const passRate    = totalInspections > 0 ? Math.round((safeCount / totalInspections) * 100) : 100;

  // Reset page when filters change
  useEffect(() => { setUnsafePage(1); setSafePage(1); }, [searchQuery, selectedType, dateFrom, dateTo]);

  // ── Pagination slices ──
  const unsafeSlice = useMemo(() =>
    unsafeRows.slice((unsafePage - 1) * PAGE_SIZE, unsafePage * PAGE_SIZE),
    [unsafeRows, unsafePage]);
  const safeSlice = useMemo(() =>
    safeRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [safeRows, safePage]);

  const setThisMonth = () => { setDateFrom(firstOfMonthStr()); setDateTo(todayStr()); };
  const clearDates   = () => { setDateFrom(''); setDateTo(''); };

  // ─── Render ──────────────────────────────────────────────────────────────

  const tableHeaderCls = 'border-b border-line';

  const renderTable = (rows: InspectionRecord[], tab: TabKey, page: number, setPage: (p: number) => void) => {
    const isUnsafe = tab === 'unsafe';
    return (
      <div>
        {loading ? (
          <div className="py-20 text-center text-ink-500 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500" />
            <p className="text-sm">Loading reports…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-ink-500">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full mb-4 ${isUnsafe ? 'bg-emerald-950/50 text-emerald-400' : 'bg-sky-950/50 text-sky-400'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isUnsafe ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="9" />}
              </svg>
            </div>
            <p className="text-sm">{isUnsafe ? 'Great news! No unsafe conditions found.' : 'No safe records match your filters.'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`${tableHeaderCls} bg-ink-950/40`}>
                    <th className="th">Equipment ID</th>
                    <th className="th">Type</th>
                    <th className="th">Date / Period</th>
                    <th className="th">Inspector</th>
                    <th className="th">Remarks</th>
                    <th className="th text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setViewingRecord(item)}
                      className={`transition-colors cursor-pointer group ${
                        isUnsafe
                          ? 'hover:bg-rose-950/10'
                          : 'hover:bg-emerald-950/10'
                      }`}
                    >
                      <td className={`td font-bold ${isUnsafe ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {item.equipment_no_id}
                      </td>
                      <td className="td">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(item.equipment_type)}`}>
                          {item.equipment_type}
                        </span>
                      </td>
                      <td className="td text-xs text-ink-300">
                        <div>{item.inspection_date}</div>
                        <div className="text-ink-500 text-[11px]">{item.week} ({item.month_year})</div>
                      </td>
                      <td className="td text-xs text-ink-200">{item.inspector_name}</td>
                      <td className="td text-xs text-ink-400 max-w-[200px] truncate">
                        {item.remarks || <span className="italic text-ink-600">No remarks</span>}
                      </td>
                      <td className="td text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewingRecord(item); }}
                          className={`btn btn-ghost text-xs px-3 py-1 ${isUnsafe ? 'text-rose-400 hover:bg-rose-950/50' : 'text-emerald-400 hover:bg-emerald-950/50'}`}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={isUnsafe ? unsafeRows.length : safeRows.length}
              page={page}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* ── Header ── */}
          <div className="panel p-5 md:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink-100">Inspection Reports</h1>
                <p className="text-xs text-ink-400 mt-0.5">
                  Monitor safety conditions and track equipment requiring immediate attention.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lastFetched && (
                  <span className="text-[11px] text-ink-600 hidden md:block">
                    Updated {lastFetched.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="btn btn-ghost text-xs flex items-center gap-1.5 px-3 py-2"
                  title="Refresh data"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? 'animate-spin' : ''}>
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-end gap-3">
              {/* Search */}
              <div className="flex-1 min-w-[160px]">
                <label className="field-label text-[10px]">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ID, inspector, type…"
                  className="input text-xs"
                />
              </div>

              {/* Type filter */}
              <div className="flex-1 min-w-[140px]">
                <label className="field-label text-[10px]">Equipment Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="input text-xs"
                >
                  <option value="All">All Types</option>
                  {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Date from */}
              <div>
                <label className="field-label text-[10px]">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input text-xs w-36"
                />
              </div>

              {/* Date to */}
              <div>
                <label className="field-label text-[10px]">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input text-xs w-36"
                />
              </div>

              {/* Quick picks */}
              <div className="flex gap-2 pb-0.5">
                <button
                  onClick={setThisMonth}
                  className="btn btn-ghost text-xs px-3 py-2 whitespace-nowrap"
                >
                  This Month
                </button>
                {(dateFrom || dateTo) && (
                  <button
                    onClick={clearDates}
                    className="btn btn-ghost text-xs px-3 py-2 text-rose-400 hover:text-rose-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── KPI Cards + Pass Ring + Type Breakdown ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="col-span-2 md:col-span-3 lg:col-span-2 grid grid-cols-2 gap-4">
              <KpiCard label="Total" value={totalInspections} sub="All filtered" color="text-ink-100" />
              <KpiCard label="Needs Attention" value={unsafeCount} sub="Action required" color="text-rose-400" borderColor="border-rose-900/30" />
              <KpiCard label="Safe" value={safeCount} sub="PASS results" color="text-emerald-400" borderColor="border-emerald-900/30" />
              <PassRateRing rate={passRate} />
            </div>
            <div className="col-span-2 md:col-span-3 lg:col-span-4">
              <TypeBreakdown inspections={filteredInspections} />
            </div>
          </div>

          {/* ── Tabbed Table ── */}
          <div className="panel overflow-hidden p-0">
            {/* Tab bar */}
            <div className="flex border-b border-line bg-ink-950/40">
              <button
                onClick={() => setActiveTab('unsafe')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'unsafe'
                    ? 'border-rose-500 text-rose-400'
                    : 'border-transparent text-ink-500 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Unsafe Conditions
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'unsafe' ? 'bg-rose-950/80 text-rose-300' : 'bg-ink-800 text-ink-500'
                }`}>
                  {unsafeCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('safe')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'safe'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-ink-500 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                Safe Conditions
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'safe' ? 'bg-emerald-950/80 text-emerald-300' : 'bg-ink-800 text-ink-500'
                }`}>
                  {safeCount}
                </span>
              </button>
            </div>

            {/* Section label */}
            <div className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b border-line ${
              activeTab === 'unsafe'
                ? 'text-rose-400 bg-rose-950/10'
                : 'text-emerald-400 bg-emerald-950/10'
            }`}>
              {activeTab === 'unsafe'
                ? '⚠️ Requires immediate follow-up'
                : '✅ Equipment in safe condition'}
            </div>

            {/* Table */}
            {activeTab === 'unsafe'
              ? renderTable(unsafeSlice, 'unsafe', unsafePage, setUnsafePage)
              : renderTable(safeSlice,   'safe',   safePage,   setSafePage)}
          </div>

        </div>
      </div>

      <InspectionDetailModal
        inspection={viewingRecord}
        onClose={() => setViewingRecord(null)}
      />
    </>
  );
}
