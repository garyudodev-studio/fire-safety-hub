'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
    case 'Fire Alarm':          return 'bg-sky-950/60 text-sky-300 border-sky-900/60';
    case 'Fire Hydrant':        return 'bg-cyan-950/60 text-cyan-300 border-cyan-900/60';
    case 'Fire Extinguisher':   return 'bg-orange-950/60 text-orange-300 border-orange-900/60';
    case 'Emergency Lamp':      return 'bg-amber-950/60 text-amber-300 border-amber-900/60';
    default:                    return 'bg-white/[0.04] text-ink-300 border-line';
  }
}

const EQUIPMENT_TYPES = [
  'Fire Extinguisher',
  'Fire Alarm',
  'Fire Hydrant',
  'Emergency Lamp',
];

const PAGE_SIZE = 13;

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

export default function GuestReportsPage() {
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
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedWeek,  setSelectedWeek]  = useState('');

  // Tab & pagination
  const [activeTab,     setActiveTab]     = useState<TabKey>('uninspected');
  const [unsafePage,    setUnsafePage]    = useState(1);
  const [safePage,      setSafePage]      = useState(1);
  const [uninspPage,    setUninspPage]    = useState(1);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // ── Derived filter options from masterlist ──
  const uniqueEntities   = useMemo(() => ['All', ...Array.from(new Set(masterlist.map(e => e.entity).filter(Boolean) as string[])).sort()], [masterlist]);
  const uniqueFacilities = useMemo(() => {
    const base = masterlist.filter(m => selectedEntity === 'All' || m.entity === selectedEntity);
    return ['All', ...Array.from(new Set(base.map(m => m.facility).filter(Boolean) as string[])).sort()];
  }, [masterlist, selectedEntity]);

  const monthOptions = useMemo(() => {
    return Array.from(new Set(inspections.map((i) => i.month_year).filter(Boolean))).sort().reverse();
  }, [inspections]);

  const weekOptions = useMemo(() => {
    const base = inspections.filter((i) => i.month_year === selectedMonth);
    return Array.from(new Set(base.map((i) => i.week).filter(Boolean))).sort();
  }, [inspections, selectedMonth]);

  // ── Fetch (guest: no auth required) ──
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [inspRes, masterRes] = await Promise.all([
        supabase
          .from('inspections')
          .select(`*, equipment:equipment_id(location, facility, area, entity)`)
          .order('created_at', { ascending: false }),
        supabase
          .from('equipment')
          .select('id, no_id, type, entity, facility, area, location')
      ]);

      if (!inspRes.error   && inspRes.data)    setInspections(inspRes.data as InspectionRecord[]);
      if (!masterRes.error && masterRes.data)  setMasterlist(masterRes.data as EquipmentMaster[]);

      setLastFetched(new Date());
      setLoading(false);
    };

    fetchData();
  }, [supabase, reloadTrigger]);

  // ── Apply filters to inspections ──
  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      const matchSearch =
        item.equipment_no_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.inspector_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.equipment_type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType     = selectedType     === 'All' || item.equipment_type === selectedType;
      const entity        = item.equipment?.entity   ?? '';
      const facility      = item.equipment?.facility ?? '';
      const matchEntity   = selectedEntity   === 'All' || entity   === selectedEntity;
      const matchFacility = selectedFacility === 'All' || facility === selectedFacility;

      const matchMonth = !selectedMonth || item.month_year === selectedMonth;
      const matchWeek  = !selectedWeek  || item.week === selectedWeek;

      return matchSearch && matchType && matchEntity && matchFacility && matchMonth && matchWeek;
    });
  }, [inspections, searchQuery, selectedType, selectedEntity, selectedFacility, selectedMonth, selectedWeek]);

  // ── Apply same filters to masterlist for coverage ──
  const filteredMasterlist = useMemo(() => {
    return masterlist.filter((m) => {
      const matchType     = selectedType     === 'All' || m.type     === selectedType;
      const matchEntity   = selectedEntity   === 'All' || m.entity   === selectedEntity;
      const matchFacility = selectedFacility === 'All' || m.facility === selectedFacility;
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
      .filter((m) => !uniqueInspectedSet.has(m.no_id))
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
  const [prevEntity, setPrevEntity] = useState(selectedEntity);
  if (prevEntity !== selectedEntity) {
    setPrevEntity(selectedEntity);
    setSelectedFacility('All');
  }
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

  // ─── Render ──────────────────────────────────────────────────────────────

  const renderInspectionTable = (rows: InspectionRecord[], isUnsafe: boolean) => {
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
              page={isUnsafe ? unsafePage : safePage}
              pageSize={PAGE_SIZE}
              onChange={isUnsafe ? setUnsafePage : setSafePage}
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
                  Public guest view. Monitor safety conditions, track equipment coverage, and see which equipment is still uninspected.
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

            {/* Filter row 1: search, entity, facility, type */}
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

            {/* Filter row 2: month then week */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="field-label text-[10px]">Month</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="input text-xs w-40">
                  <option value="">All Months</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
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
            <KpiCard label="Pass Rate" value={`${passRate}%`} sub="Safe / inspected" color="text-sky-400" />
          </div>

          {/* ── Tabbed Panel ── */}
          <div className="panel overflow-hidden p-0">
            <div className="flex flex-wrap border-b border-line bg-ink-950/40">
              <button
                onClick={() => setActiveTab('uninspected')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'uninspected' ? 'border-amber-500 text-amber-400' : 'border-transparent text-ink-600 hover:text-ink-300'
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
                  activeTab === 'unsafe' ? 'border-rose-500 text-rose-400' : 'border-transparent text-ink-600 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="16" />
                </svg>
                Unsafe Conditions
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'unsafe' ? 'bg-rose-950/80 text-rose-300' : 'bg-ink-800 text-ink-500'}`}>
                  {unsafeCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('safe')}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'safe' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-ink-600 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Safe Conditions
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'safe' ? 'bg-emerald-950/80 text-emerald-300' : 'bg-ink-800 text-ink-500'}`}>
                  {safeCount}
                </span>
              </button>
            </div>

            {/* Active tab body */}
            {activeTab === 'uninspected'
              ? renderUninspectedTable()
              : activeTab === 'safe'
                ? renderInspectionTable(safeSlice, false)
                : renderInspectionTable(unsafeSlice, true)}
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