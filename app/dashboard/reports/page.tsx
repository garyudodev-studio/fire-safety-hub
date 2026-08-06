'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import InspectionDetailModal, { InspectionRecord } from '@/app/components/inspection/InspectionDetailModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EquipmentMaster {
  id: string;
  no_id: string;
  type: string;
  entity: string | null;
  facility: string | null;
  area: string | null;
  location: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'Fire Alarm':          return 'bg-ember-950/60 text-ember-300 border-ember-900/60';
    case 'Fire Hydrant':        return 'bg-sky-950/60 text-sky-300 border-sky-900/60';
    case 'Fire Extinguisher':   return 'bg-orange-950/60 text-orange-300 border-orange-900/60';
    case 'Emergency Lamp':      return 'bg-amber-950/60 text-amber-300 border-amber-900/60';
    default:                    return 'bg-white/[0.04] text-ink-300 border-line';
  }
}

const TYPE_COLORS: Record<string, string> = {
  'Fire Extinguisher':   '#f97316',
  'Fire Alarm':          '#ef4444',
  'Fire Hydrant':        '#38bdf8',
  'Emergency Lamp':      '#fbbf24',
};

const EQUIPMENT_TYPES = [
  'Fire Extinguisher',
  'Fire Alarm',
  'Fire Hydrant',
  'Emergency Lamp',
];

const PAGE_SIZE = 13;

function formatMonthYear(monthYear: string): string {
  const [mm, yyyy] = monthYear.split('/');
  const monthNum = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (!mm || isNaN(monthNum) || isNaN(year)) return monthYear;
  return `${new Date(Date.UTC(year, monthNum - 1)).toLocaleString('en-US', { month: 'long' })} ${year}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color = 'text-ink-100', borderColor = '',
}: {
  label: string; value: string | number; sub?: string;
  color?: string; borderColor?: string;
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
            fill="none" stroke={color} strokeWidth="8"
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

/**
 * Equipment Type Breakdown
 * Shows: inspected_count / total_masterlist_count, plus pass count out of inspections
 *
 * Bar visual:
 *   full-width track = total masterlist equipment for this type
 *   lighter shade    = inspected so far (any status)
 *   solid fill       = PASS inspections
 */
function TypeBreakdown({
  inspections,
  masterlist,
  periodText,
}: {
  inspections: InspectionRecord[];
  masterlist: EquipmentMaster[];
  periodText: string;
}) {
  const totalMasterlistAll = masterlist.length;
  const uniqueAllInspected = new Set(inspections.map((i) => i.equipment_no_id)).size;
  const overallPending = Math.max(0, totalMasterlistAll - uniqueAllInspected);
  const overallCoverage = totalMasterlistAll > 0 ? Math.round((uniqueAllInspected / totalMasterlistAll) * 100) : 0;

  const rows = EQUIPMENT_TYPES.map((t) => {
    const totalEquip  = masterlist.filter((e) => e.type === t).length;
    const inspected   = inspections.filter((i) => i.equipment_type === t);
    // unique equipment IDs inspected in the date window
    const uniqueInspectedIds = new Set(inspected.map((i) => i.equipment_no_id));
    const inspectedCount = uniqueInspectedIds.size;
    const passCount = inspected.filter((i) => i.status === 'PASS').length;
    const notInspected = Math.max(0, totalEquip - inspectedCount);
    const passRate = inspected.length > 0 ? Math.round((passCount / inspected.length) * 100) : null;
    const coverage = totalEquip > 0 ? Math.round((inspectedCount / totalEquip) * 100) : null;

    return { type: t, totalEquip, inspectedCount, passCount, notInspected, passRate, coverage, inspections: inspected };
  }).filter((r) => r.totalEquip > 0 || r.inspectedCount > 0);

  if (rows.length === 0) return (
    <div className="panel p-5 flex items-center justify-center text-ink-600 text-sm">
      No equipment data available
    </div>
  );

  const maxEquip = Math.max(...rows.map((r) => Math.max(r.totalEquip, 1)));

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-200 flex items-center gap-2">
            Equipment Coverage Breakdown
            <span className="text-[10px] font-normal px-2.5 py-0.5 rounded-full bg-ember-950/80 text-ember-300 border border-ember-900/60 font-mono">
              📅 Period: {periodText}
            </span>
          </h3>
          <p className="text-xs text-ink-400 mt-1">
            Masterlist total: <strong className="text-ink-100">{totalMasterlistAll}</strong> equipment · Inspected: <strong className="text-sky-300">{uniqueAllInspected}/{totalMasterlistAll} ({overallCoverage}%)</strong>
          </p>
        </div>

        <div>
          {overallPending === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-900/60">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              100% Fully Inspected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-900/60">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {overallPending} Equipment Pending Inspection
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-1">
        {rows.map((r) => {
          const col = TYPE_COLORS[r.type] ?? '#8b91a0';
          const trackW   = r.totalEquip  > 0 ? (r.totalEquip   / maxEquip) * 100 : 0;
          const inspW    = r.totalEquip  > 0 ? (r.inspectedCount / r.totalEquip) * 100 : 0;
          const passW    = r.inspectedCount > 0 ? (r.passCount / r.inspectedCount) * 100 : 0;

          return (
            <div key={r.type} className="space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                <span className="text-ink-200 font-semibold truncate">{r.type}</span>
                <div className="flex items-center gap-2 shrink-0 text-ink-400">
                  <span className="bg-ink-850 px-2 py-0.5 rounded border border-line">
                    Inspected: <strong className="text-ink-100">{r.inspectedCount}</strong> / <span className="text-ink-300">{r.totalEquip} Masterlist Total</span>
                  </span>
                  {r.passRate !== null && (
                    <span style={{ color: col }} className="font-bold">{r.passRate}% PASS</span>
                  )}
                  {r.notInspected > 0 ? (
                    <span className="text-amber-400 font-bold bg-amber-950/50 border border-amber-900/50 px-2 py-0.5 rounded text-[11px]">
                      {r.notInspected} Not Yet Inspected
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-900/50 px-2 py-0.5 rounded text-[11px]">
                      ✓ Complete
                    </span>
                  )}
                </div>
              </div>

              {/* Three-layer bar */}
              <div className="relative h-3 rounded-full bg-ink-800 overflow-hidden" style={{ width: `${Math.max(trackW, 100)}%`, maxWidth: '100%' }}>
                {/* layer 1: inspected portion */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                  style={{ width: `${inspW}%`, backgroundColor: `${col}40` }}
                />
                {/* layer 2: pass portion */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                  style={{ width: `${(inspW * passW) / 100}%`, backgroundColor: col }}
                />
              </div>

              {/* Coverage % details */}
              <div className="flex items-center justify-between text-[11px] text-ink-500">
                <span>
                  {r.coverage}% of total masterlist equipment inspected in this period
                </span>
                {r.notInspected > 0 && (
                  <span className="text-amber-400">
                    {r.notInspected} equipment remaining for this period
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert banner if pending items remain */}
      {overallPending > 0 && (
        <div className="mt-3 rounded-xl bg-amber-950/40 border border-amber-900/50 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p className="font-bold">Inspection Period Incomplete ({periodText})</p>
            <p className="mt-0.5 text-amber-300/80">
              <strong>{overallPending} out of {totalMasterlistAll}</strong> masterlist equipment have not been inspected during this period.
              Ensure all equipment items receive inspection.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Pagination({
  total, page, pageSize, onChange,
}: {
  total: number; page: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  const win = 2;
  const lo = Math.max(1, page - win);
  const hi = Math.min(totalPages, page + win);
  if (lo > 1) { pages.push(1); if (lo > 2) pages.push('…'); }
  for (let i = lo; i <= hi; i++) pages.push(i);
  if (hi < totalPages) { if (hi < totalPages - 1) pages.push('…'); pages.push(totalPages); }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-line bg-ink-950/40">
      <span className="text-xs text-ink-500">
        {total === 0 ? '0 results' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="px-2.5 py-1.5 rounded-lg text-xs text-ink-400 hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          ‹ Prev
        </button>
        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`e${idx}`} className="px-1.5 text-ink-600 text-xs">…</span>
          ) : (
            <button key={p} onClick={() => onChange(p as number)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-ember-600 text-white' : 'text-ink-400 hover:bg-ink-800'}`}>
              {p}
            </button>
          )
        )}
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages}
          className="px-2.5 py-1.5 rounded-lg text-xs text-ink-400 hover:bg-ink-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Next ›
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = 'uninspected' | 'unsafe' | 'safe';

export default function ReportsPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [masterlist,  setMasterlist]  = useState<EquipmentMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [viewingRecord, setViewingRecord] = useState<InspectionRecord | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType,     setSelectedType]     = useState('All');
  const [selectedEntity,   setSelectedEntity]   = useState('All');
  const [selectedFacility, setSelectedFacility] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState(''); // "MM/YYYY" from inspection data
  const [selectedWeek,  setSelectedWeek]  = useState(''); // "Week N" from inspection data

  // Tab & pagination
  const [activeTab,   setActiveTab]   = useState<TabKey>('uninspected');
  const [unsafePage,  setUnsafePage]  = useState(1);
  const [safePage,    setSafePage]    = useState(1);
  const [uninspPage,  setUninspPage]  = useState(1);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // ── Derived filter options from masterlist ──
  const uniqueEntities   = useMemo(() => ['All', ...Array.from(new Set(masterlist.map(e => e.entity).filter(Boolean) as string[])).sort()], [masterlist]);
  const uniqueFacilities = useMemo(() => {
    const base = masterlist.filter(e => selectedEntity === 'All' || e.entity === selectedEntity);
    return ['All', ...Array.from(new Set(base.map(e => e.facility).filter(Boolean) as string[])).sort()];
  }, [masterlist, selectedEntity]);

  // ── Period options derived from inspection data ──
  const monthOptions = useMemo(() => {
    return Array.from(new Set(inspections.map((i) => i.month_year).filter(Boolean))).sort().reverse();
  }, [inspections]);

  const weekOptions = useMemo(() => {
    const base = inspections.filter((i) => i.month_year === selectedMonth);
    return Array.from(new Set(base.map((i) => i.week).filter(Boolean))).sort();
  }, [inspections, selectedMonth]);

  // ── Fetch ──
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.push('/'); return; }

      const [inspRes, masterRes, profileRes] = await Promise.all([
        supabase
          .from('inspections')
          .select(`*, equipment:equipment_id(location, facility, area, entity)`)
          .order('created_at', { ascending: false }),
        supabase
          .from('equipment')
          .select('id, no_id, type, entity, facility, area, location'),
        supabase
          .from('profiles')
          .select('role, entity, facility, pic:pic_id(entity, facility)')
          .eq('id', sessionData.session.user.id)
          .single()
      ]);

      if (!inspRes.error   && inspRes.data)   setInspections(inspRes.data as InspectionRecord[]);
      if (!masterRes.error && masterRes.data)  setMasterlist(masterRes.data as EquipmentMaster[]);

      if (profileRes.data) {
        const userProfile = profileRes.data;
        const assignedEntity = userProfile.entity || userProfile.pic?.entity;
        const assignedFacility = userProfile.facility || userProfile.pic?.facility;
        if (assignedEntity) setSelectedEntity(assignedEntity);
        if (assignedFacility) setSelectedFacility(assignedFacility);
      }

      setLastFetched(new Date());
      setLoading(false);
    };

    fetchData();
  }, [supabase, router, reloadTrigger]);

  // ── Apply filters to inspections ──
  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      const matchSearch =
        item.equipment_no_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.inspector_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.equipment_type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType     = selectedType     === 'All' || item.equipment_type === selectedType;
      // Entity and facility come from the joined equipment relation
      const entity   = item.equipment?.entity   ?? '';
      const facility = item.equipment?.facility ?? '';
      const matchEntity   = selectedEntity   === 'All' || entity   === selectedEntity;
      const matchFacility = selectedFacility === 'All' || facility === selectedFacility;

      const matchMonth = !selectedMonth || item.month_year === selectedMonth;
      const matchWeek  = !selectedWeek  || item.week === selectedWeek;

      return matchSearch && matchType && matchEntity && matchFacility && matchMonth && matchWeek;
    });
  }, [inspections, searchQuery, selectedType, selectedEntity, selectedFacility, selectedMonth, selectedWeek]);

  // ── Apply same entity/facility/type filter to masterlist for coverage numbers ──
  const filteredMasterlist = useMemo(() => {
    return masterlist.filter((e) => {
      const matchType     = selectedType     === 'All' || e.type     === selectedType;
      const matchEntity   = selectedEntity   === 'All' || e.entity   === selectedEntity;
      const matchFacility = selectedFacility === 'All' || e.facility === selectedFacility;
      return matchType && matchEntity && matchFacility;
    });
  }, [masterlist, selectedType, selectedEntity, selectedFacility]);

  const unsafeRows = useMemo(() => filteredInspections.filter(i => i.status !== 'PASS'), [filteredInspections]);
  const safeRows   = useMemo(() => filteredInspections.filter(i => i.status === 'PASS'),  [filteredInspections]);

  const totalInspections = filteredInspections.length;
  const safeCount   = safeRows.length;
  const unsafeCount = unsafeRows.length;
  const passRate    = totalInspections > 0 ? Math.round((safeCount / totalInspections) * 100) : 100;

  // Coverage KPI
  const uniqueInspectedSet = useMemo(() => new Set(filteredInspections.map(i => i.equipment_no_id)), [filteredInspections]);
  const totalMasterlistCount = filteredMasterlist.length;
  const inspectedCount = uniqueInspectedSet.size;
  const notInspectedCount = Math.max(0, totalMasterlistCount - inspectedCount);

  // ★ Uninspected equipment list from the masterlist
  const uninspectedRows = useMemo(() => {
    return filteredMasterlist
      .filter((e) => !uniqueInspectedSet.has(e.no_id))
      .sort((a, b) => a.no_id.localeCompare(b.no_id));
  }, [filteredMasterlist, uniqueInspectedSet]);

  // Reset pages when filters change
  const filterSignature = [searchQuery, selectedType, selectedEntity, selectedFacility, selectedMonth, selectedWeek].join('|');
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  if (prevFilterSignature !== filterSignature) {
    setPrevFilterSignature(filterSignature);
    setUnsafePage(1);
    setSafePage(1);
    setUninspPage(1);
  }
  // Reset facility when entity changes
  const [prevEntity, setPrevEntity] = useState(selectedEntity);
  if (prevEntity !== selectedEntity) {
    setPrevEntity(selectedEntity);
    setSelectedFacility('All');
  }
  // Reset week when month changes
  const [prevMonth, setPrevMonth] = useState(selectedMonth);
  if (prevMonth !== selectedMonth) {
    setPrevMonth(selectedMonth);
    setSelectedWeek('');
  }

  // ── Pagination slices ──
  const unsafeSlice = useMemo(() => unsafeRows.slice((unsafePage - 1) * PAGE_SIZE, unsafePage * PAGE_SIZE), [unsafeRows, unsafePage]);
  const safeSlice   = useMemo(() => safeRows.slice((safePage   - 1) * PAGE_SIZE, safePage   * PAGE_SIZE), [safeRows, safePage]);
  const uninspSlice = useMemo(() => uninspectedRows.slice((uninspPage - 1) * PAGE_SIZE, uninspPage * PAGE_SIZE), [uninspectedRows, uninspPage]);

  const setThisMonth = () => {
    const now = new Date();
    setSelectedMonth(`${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`);
    setSelectedWeek('');
  };
  const clearDates = () => {
    setSelectedMonth('');
    setSelectedWeek('');
  };

  const periodText = selectedMonth
    ? `${formatMonthYear(selectedMonth)}${selectedWeek ? `, ${selectedWeek}` : ''}`
    : 'All Recorded Dates';

  // ─── Render ──────────────────────────────────────────────────────────────

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
                  <tr className="border-b border-line bg-ink-950/40">
                    <th className="th">Equipment ID</th>
                    <th className="th">Type</th>
                    <th className="th">Entity / Facility</th>
                    <th className="th">Date / Period</th>
                    <th className="th">Inspector</th>
                    <th className="th">Remarks</th>
                    <th className="th text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((item) => {
                    const entity   = item.equipment?.entity   ?? '';
                    const facility = item.equipment?.facility ?? '';
  return (
    <tr
      key={item.id}
                        onClick={() => setViewingRecord(item)}
                        className={`transition-colors cursor-pointer ${isUnsafe ? 'hover:bg-rose-950/10' : 'hover:bg-emerald-950/10'}`}
                      >
                        <td className={`td font-bold ${isUnsafe ? 'text-rose-300' : 'text-emerald-300'}`}>
                          {item.equipment_no_id}
                        </td>
                        <td className="td">
                          <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(item.equipment_type)}`}>
                            {item.equipment_type}
                          </span>
                        </td>
                        <td className="td text-xs">
                          {entity && <div className="text-ink-200 font-medium">{entity}</div>}
                          {facility && <div className="text-ink-500 text-[11px]">{facility}</div>}
                          {!entity && !facility && <span className="text-ink-600 italic">—</span>}
                        </td>
                        <td className="td text-xs text-ink-300">
                          <div>{item.inspection_date}</div>
                          <div className="text-ink-500 text-[11px]">{item.week} ({item.month_year})</div>
                        </td>
                        <td className="td text-xs text-ink-200">{item.inspector_name}</td>
                        <td className="td text-xs text-ink-400 max-w-[180px] truncate">
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
                    );
                  })}
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

  // ★ Uninspected equipment table
  const renderUninspectedTable = () => {
    return (
      <div>
        {loading ? (
          <div className="py-20 text-center text-ink-500 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500" />
            <p className="text-sm">Loading equipment…</p>
          </div>
        ) : uninspSlice.length === 0 ? (
          <div className="py-16 text-center text-ink-500">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4 bg-emerald-950/50 text-emerald-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm">
              {notInspectedCount === 0
                ? 'All equipment in the masterlist has been inspected. No pending items.'
                : 'No uninspected equipment match your filters.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line bg-ink-950/40">
                    <th className="th">Equipment ID</th>
                    <th className="th">Type</th>
                    <th className="th">Entity / Facility</th>
                    <th className="th">Area / Location</th>
                    <th className="th text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {uninspSlice.map((equip) => (
                    <tr key={equip.id} className="transition-colors hover:bg-amber-950/10">
                      <td className="td font-bold text-amber-300">{equip.no_id}</td>
                      <td className="td">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(equip.type)}`}>
                          {equip.type}
                        </span>
                      </td>
                      <td className="td text-xs">
                        {equip.entity && <div className="text-ink-200 font-medium">{equip.entity}</div>}
                        {equip.facility && <div className="text-ink-500 text-[11px]">{equip.facility}</div>}
                        {!equip.entity && !equip.facility && <span className="text-ink-600 italic">—</span>}
                      </td>
                      <td className="td text-xs text-ink-300">
                        {[equip.area, equip.location].filter(Boolean).join(' · ') || (equip.area || '—')}
                      </td>
                      <td className="td text-right">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-800/50">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          Not Inspected
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={uninspectedRows.length}
              page={uninspPage}
              pageSize={PAGE_SIZE}
              onChange={setUninspPage}
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
                  Monitor safety conditions and track equipment coverage within inspection periods.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {lastFetched && (
                  <span className="text-[11px] text-ink-600 hidden md:block">
                    Updated {lastFetched.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={() => { setLoading(true); setReloadTrigger((t) => t + 1); }} disabled={loading}
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

            {/* Filter row — row 1: search, entity, facility, type */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="field-label text-[10px]">Search</label>
                <input
                  type="text" value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ID, inspector, type…"
                  className="input text-xs"
                />
              </div>

              <div className="flex-1 min-w-[120px]">
                <label className="field-label text-[10px]">Entity</label>
                <select value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)} className="input text-xs">
                  {uniqueEntities.map(e => <option key={e} value={e}>{e === 'All' ? 'All Entities' : e}</option>)}
                </select>
              </div>

              <div className="flex-1 min-w-[120px]">
                <label className="field-label text-[10px]">Facility</label>
                <select value={selectedFacility} onChange={(e) => setSelectedFacility(e.target.value)} className="input text-xs">
                  {uniqueFacilities.map(f => <option key={f} value={f}>{f === 'All' ? 'All Facilities' : f}</option>)}
                </select>
              </div>

              <div className="flex-1 min-w-[120px]">
                <label className="field-label text-[10px]">Equipment Type</label>
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="input text-xs">
                  <option value="All">All Types</option>
                  {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Filter row 2: period (month then week) */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="field-label text-[10px]">Month</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="input text-xs w-40">
                  <option value="">All Months</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{formatMonthYear(m)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label text-[10px]">Week</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  disabled={!selectedMonth}
                  className="input text-xs w-36"
                >
                  <option value="">All Weeks</option>
                  {weekOptions.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pb-0.5">
                <button onClick={setThisMonth} className="btn btn-ghost text-xs px-3 py-2 whitespace-nowrap">
                  This Month
                </button>
                {(selectedMonth || selectedWeek) && (
                  <button onClick={clearDates} className="btn btn-ghost text-xs px-3 py-2 text-rose-400 hover:text-rose-300">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard label="Total Inspections" value={totalInspections} sub="In selected filters" color="text-ink-100" />
            <KpiCard label="Needs Attention"  value={unsafeCount} sub="Action required" color="text-rose-400" borderColor="border-rose-900/30" />
            <KpiCard label="Safe"             value={safeCount}   sub="PASS results"    color="text-emerald-400" borderColor="border-emerald-900/30" />
            <KpiCard
              label="Not Inspected"
              value={notInspectedCount}
              sub={`of ${totalMasterlistCount} total equipment`}
              color={notInspectedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}
              borderColor={notInspectedCount > 0 ? 'border-amber-900/30' : 'border-emerald-900/30'}
            />
            <PassRateRing rate={passRate} />
          </div>

          {/* ── Coverage Breakdown ── */}
          <TypeBreakdown
            inspections={filteredInspections}
            masterlist={filteredMasterlist}
            periodText={periodText}
          />

          {/* ── Tabbed Table ── */}
          <div className="panel overflow-hidden p-0">
            {/* Tab bar */}
            <div className="flex overflow-x-auto border-b border-line bg-ink-950/40">
              <button
                onClick={() => setActiveTab('uninspected')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'uninspected' ? 'border-amber-500 text-amber-400' : 'border-transparent text-ink-500 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Uninspected Equipment
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'uninspected' ? 'bg-amber-950/80 text-amber-300' : 'bg-ink-800 text-ink-500'}`}>
                  {notInspectedCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('unsafe')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'unsafe' ? 'border-rose-500 text-rose-400' : 'border-transparent text-ink-500 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Unsafe Conditions
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'unsafe' ? 'bg-rose-950/80 text-rose-300' : 'bg-ink-800 text-ink-500'}`}>
                  {unsafeCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('safe')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'safe' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-ink-500 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                Safe Conditions
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'safe' ? 'bg-emerald-950/80 text-emerald-300' : 'bg-ink-800 text-ink-500'}`}>
                  {safeCount}
                </span>
              </button>
            </div>

            <div className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider border-b border-line ${
              activeTab === 'uninspected'
                ? 'text-amber-400 bg-amber-950/10'
                : activeTab === 'unsafe'
                  ? 'text-rose-400 bg-rose-950/10'
                  : 'text-emerald-400 bg-emerald-950/10'
            }`}>
              {activeTab === 'uninspected'
                ? '⚠️ Masterlist equipment not yet inspected'
                : activeTab === 'unsafe'
                  ? '⚠️ Requires immediate follow-up'
                  : '✅ Equipment in safe condition'}
            </div>

            {activeTab === 'uninspected'
              ? renderUninspectedTable()
              : activeTab === 'unsafe'
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
