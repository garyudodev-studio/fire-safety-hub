'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import InspectionDetailModal, { InspectionRecord } from '@/app/components/inspection/InspectionDetailModal';
import ImprovementModal, { ImprovementRecord } from '@/app/components/inspection/ImprovementModal';
import InspectionForm from '@/app/components/inspection/InspectionForm';
import { printInspectionResults } from '@/app/lib/printInspectionResults';
import { printResultReport } from '@/app/lib/printResultReport';
import { getPeriodEndDate, equipmentExistsInPeriod } from '@/app/lib/equipmentPeriod';
import ProtectedImage from '@/app/components/ui/ProtectedImage';
import { AlertModal, AlertState } from '@/app/components/ui/CustomModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EquipmentPic {
  id?: string;
  name?: string | null;
  phone?: string | null;
  image_profile?: string | null;
  image_contact?: string | null;
}

interface EquipmentMaster {
  id: string;
  no_id: string;
  type: string;
  entity: string | null;
  facility: string | null;
  area: string | null;
  location: string | null;
  created_at?: string | null;
  start_date?: string | null;
  pic_1?: EquipmentPic | null;
  pic_2?: EquipmentPic | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'Fire Alarm':          return 'tone-ember';
    case 'Fire Hydrant':        return 'tone-sky';
    case 'Fire Extinguisher':   return 'tone-orange';
    case 'Emergency Lamp':      return 'tone-amber';
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
    <div className={`panel p-3 sm:p-5 flex flex-col items-center justify-center text-center gap-1 ${borderColor}`}>
      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</span>
      <span className={`text-2xl sm:text-4xl font-bold mt-1 ${color}`}>{value}</span>
      {sub && <span className="text-[10px] sm:text-xs text-ink-500 mt-0.5 leading-tight">{sub}</span>}
    </div>
  );
}

function PassRateRing({ rate, addressed = 0 }: { rate: number; addressed?: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  const color = rate >= 80 ? '#34d399' : rate >= 50 ? '#fbbf24' : '#f87171';
  return (
    <div className="panel p-5 flex flex-col items-center justify-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Health Score</span>
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
      <span className="text-xs text-ink-500">
        {addressed > 0 ? `${addressed} resolved or in progress via CAPA` : 'Pass rate + CAPA'}
      </span>
    </div>
  );
}

function FilterRequired({ scope = 'data' }: { scope?: string }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full tone-sky">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </span>
      <p className="text-sm text-ink-300 font-medium">Select a filter to view {scope}</p>
      <p className="text-xs text-ink-500 max-w-md">
        Choose a <strong className="text-ink-300">Month</strong> (and optionally <strong className="text-ink-300">Week</strong>) above to see inspection results for that period.
      </p>
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
  hasPeriodFilter,
}: {
  inspections: InspectionRecord[];
  masterlist: EquipmentMaster[];
  periodText: string;
  hasPeriodFilter: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // Match inspected equipment by the real primary key and intersect with the masterlist,
  // so orphans / duplicate inspection rows never inflate coverage or pending counts.
  const inspectedIds = new Set(inspections.map((i) => i.equipment_id));
  const totalMasterlistAll = masterlist.length;
  const uniqueAllInspected = masterlist.filter((e) => inspectedIds.has(e.id)).length;
  const overallPending = Math.max(0, totalMasterlistAll - uniqueAllInspected);
  const overallCoverage = totalMasterlistAll > 0 ? Math.round((uniqueAllInspected / totalMasterlistAll) * 100) : 0;

  const rows = EQUIPMENT_TYPES.map((t) => {
    const typeMaster  = masterlist.filter((e) => e.type === t);
    const totalEquip  = typeMaster.length;
    const typeInspected = typeMaster.filter((e) => inspectedIds.has(e.id));
    const inspectedCount = typeInspected.length;
    const passCount = typeInspected.filter((e) =>
      inspections.some((i) => i.equipment_id === e.id && i.status === 'PASS')
    ).length;
    const notInspected = Math.max(0, totalEquip - inspectedCount);
    const passRate = inspectedCount > 0 ? Math.round((passCount / inspectedCount) * 100) : null;
    const coverage = totalEquip > 0 ? Math.round((inspectedCount / totalEquip) * 100) : null;

    return { type: t, totalEquip, inspectedCount, passCount, notInspected, passRate, coverage, inspections: typeInspected };
  }).filter((r) => r.totalEquip > 0 || r.inspectedCount > 0);

  const maxEquip = Math.max(...rows.map((r) => Math.max(r.totalEquip, 1)));

  return (
    <div className="panel overflow-hidden">
      {/* ── Toggle header (always visible) ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`shrink-0 text-ink-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-200 flex items-center gap-2">
              Equipment Coverage Breakdown
              <span className="text-[10px] font-normal px-2.5 py-0.5 rounded-full border font-mono tone-ember">
                📅 Period: {periodText}
              </span>
            </h3>
            <p className="text-[11px] text-ink-500 mt-0.5">
              {hasPeriodFilter ? (
                <>
                  Masterlist total: <strong className="text-ink-300">{totalMasterlistAll}</strong> · Inspected:{' '}
                  <strong className="text-sky-400">{uniqueAllInspected}/{totalMasterlistAll} ({overallCoverage}%)</strong>
                </>
              ) : (
                'Select a month/week filter to view coverage data'
              )}
            </p>
          </div>
        </div>

        {hasPeriodFilter && (
          <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            overallPending === 0 ? 'tone-emerald' : 'tone-amber'
          }`}>
            {overallPending === 0 ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                100% Inspected
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {overallPending} Pending
              </>
            )}
          </span>
        )}
      </button>

      {/* ── Collapsible body ── */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-line">
          {!hasPeriodFilter ? (
            <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full tone-sky">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <p className="text-sm text-ink-300 font-medium">Select a filter to view coverage data</p>
              <p className="text-xs text-ink-500 max-w-md">
                Choose a <strong className="text-ink-300">Month</strong> (and optionally <strong className="text-ink-300">Week</strong>) above to see how equipment in the masterlist has been inspected for that period.
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 flex items-center justify-center text-ink-600 text-sm">
              No equipment data available for the selected filters.
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              {rows.map((r) => {
                const col = TYPE_COLORS[r.type] ?? '#8b91a0';
                const trackW   = r.totalEquip  > 0 ? (r.totalEquip   / maxEquip) * 100 : 0;
                const inspW    = r.totalEquip  > 0 ? (r.inspectedCount / r.totalEquip) * 100 : 0;
                const passW    = r.inspectedCount > 0 ? (r.passCount / r.inspectedCount) * 100 : 0;

                return (
                  <div key={r.type} className="space-y-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                      <span className="text-ink-200 font-semibold truncate">{r.type}</span>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 text-ink-400">
                        <span className="bg-ink-850 px-2 py-0.5 rounded border border-line text-[11px] sm:text-xs">
                          Inspected: <strong className="text-ink-100">{r.inspectedCount}</strong> / <span className="text-ink-300">{r.totalEquip}</span>
                        </span>
                        {r.passRate !== null && (
                          <span style={{ color: col }} className="font-bold text-[11px] sm:text-xs">{r.passRate}% PASS</span>
                        )}
                        {r.notInspected > 0 ? (
                          <span className="tone-amber font-bold border px-2 py-0.5 rounded text-[10px] sm:text-[11px]">
                            {r.notInspected} Not Yet Inspected
                          </span>
                        ) : (
                          <span className="tone-emerald font-bold border px-2 py-0.5 rounded text-[10px] sm:text-[11px]">
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

              {/* Alert banner if pending items remain */}
              {overallPending > 0 && (
                <div className="mt-3 rounded-xl border tone-amber p-3.5 text-xs flex items-start gap-2.5">
                  <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <p className="font-bold">Inspection Period Incomplete ({periodText})</p>
                    <p className="mt-0.5 opacity-80">
                      <strong>{overallPending} out of {totalMasterlistAll}</strong> masterlist equipment have not been inspected during this period.
                      Ensure all equipment items receive inspection.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-line bg-ink-950/40">
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

type TabKey = 'uninspected' | 'unsafe' | 'safe' | 'report';

export default function ReportsPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [masterlist,  setMasterlist]  = useState<EquipmentMaster[]>([]);
  const [improvementsMap, setImprovementsMap] = useState<Map<string, ImprovementRecord>>(new Map());
  const [activeImprovementInspection, setActiveImprovementInspection] = useState<InspectionRecord | null>(null);
  const [activeExistingImprovement, setActiveExistingImprovement] = useState<ImprovementRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<InspectionRecord | null>(null);
  const [userRole, setUserRole] = useState<string>('inspector');

  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [viewingRecord, setViewingRecord] = useState<InspectionRecord | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printingReport, setPrintingReport] = useState(false);
  const [alertModal, setAlertModal] = useState<AlertState | null>(null);

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
  const [reportPage,  setReportPage]  = useState(1);
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

      const [inspRes, masterRes, profileRes, impRes] = await Promise.all([
        supabase
          .from('inspections')
          .select(`*, equipment:equipment_id(location, facility, area, entity)`)
          .order('created_at', { ascending: false }),
        supabase
          .from('equipment')
          .select(`
            id, no_id, type, entity, facility, area, location, created_at, start_date,
            pic_1:pic_1_id(id, name, phone, image_profile, image_contact),
            pic_2:pic_2_id(id, name, phone, image_profile, image_contact)
          `),
        supabase
          .from('profiles')
          .select('role, entity, facility, pic:pic_id(entity, facility)')
          .eq('id', sessionData.session.user.id)
          .single(),
        supabase
          .from('improvements')
          .select('*')
      ]);

      if (!inspRes.error   && inspRes.data)   setInspections(inspRes.data as InspectionRecord[]);
      if (!masterRes.error && masterRes.data)  setMasterlist(masterRes.data as EquipmentMaster[]);

      if (impRes.data) {
        const map = new Map<string, ImprovementRecord>();
        (impRes.data as ImprovementRecord[]).forEach((imp) => map.set(imp.inspection_id, imp));
        setImprovementsMap(map);
      }

      if (profileRes.data) {
        const userProfile = profileRes.data;
        if (userProfile.role) setUserRole(userProfile.role);
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
  // Equipment that was added to the masterlist AFTER the selected period is excluded,
  // so new equipment never inflates the "uninspected" count of past periods.
  // With "All Weeks" active, the cut-off is the latest week that actually has inspection data,
  // so equipment added after the last inspected week is not counted as uninspected.
  const periodEndDate = useMemo(
    () => getPeriodEndDate(selectedMonth, selectedWeek, weekOptions),
    [selectedMonth, selectedWeek, weekOptions]
  );
  const filteredMasterlist = useMemo(() => {
    return masterlist.filter((e) => {
      const matchType     = selectedType     === 'All' || e.type     === selectedType;
      const matchEntity   = selectedEntity   === 'All' || e.entity   === selectedEntity;
      const matchFacility = selectedFacility === 'All' || e.facility === selectedFacility;
      return matchType && matchEntity && matchFacility && equipmentExistsInPeriod(e, periodEndDate);
    });
  }, [masterlist, selectedType, selectedEntity, selectedFacility, periodEndDate]);

  const unsafeRows = useMemo(() => filteredInspections.filter(i => i.status !== 'PASS'), [filteredInspections]);
  const safeRows   = useMemo(() => filteredInspections.filter(i => i.status === 'PASS'),  [filteredInspections]);
  const resolvedCount = useMemo(
    () => unsafeRows.filter((i) => improvementsMap.get(i.id)?.status === 'RESOLVED').length,
    [unsafeRows, improvementsMap]
  );
  const inProgressCount = useMemo(
    () => unsafeRows.filter((i) => improvementsMap.get(i.id)?.status === 'IN_PROGRESS').length,
    [unsafeRows, improvementsMap]
  );
  const openCount = useMemo(
    () => unsafeRows.filter((i) => {
      const imp = improvementsMap.get(i.id);
      return !imp || imp.status === 'OPEN';
    }).length,
    [unsafeRows, improvementsMap]
  );

  const totalInspections = filteredInspections.length;
  const safeCount   = safeRows.length;
  const unsafeCount = unsafeRows.length;
  const passRate    = totalInspections > 0 ? Math.round((safeCount / totalInspections) * 100) : 100;
  const healthScore = totalInspections > 0
    ? Math.round(((safeCount + resolvedCount + inProgressCount) / totalInspections) * 100)
    : 100;

  // Coverage KPI
  // Inspected scope matches the masterlist scope (type/entity/facility) PLUS the selected
  // period (month/week), so "inspected" only counts equipment that was inspected during the
  // selected week. This keeps the "not inspected" count accurate per week without mutating
  // or affecting any previously saved inspection/report data.
  const scopeInspections = useMemo(() => {
    return inspections.filter((item) => {
      const matchType     = selectedType     === 'All' || item.equipment_type === selectedType;
      const entity        = item.equipment?.entity   ?? '';
      const facility      = item.equipment?.facility ?? '';
      const matchEntity   = selectedEntity   === 'All' || entity   === selectedEntity;
      const matchFacility = selectedFacility === 'All' || facility === selectedFacility;
      const matchMonth    = !selectedMonth   || item.month_year === selectedMonth;
      const matchWeek     = !selectedWeek    || item.week === selectedWeek;
      return matchType && matchEntity && matchFacility && matchMonth && matchWeek;
    });
  }, [inspections, selectedType, selectedEntity, selectedFacility, selectedMonth, selectedWeek]);

  // Match by the real equipment primary key (robust vs no_id string/whitespace mismatches).
  const inspectedEquipmentIds = useMemo(
    () => new Set(scopeInspections.map(i => i.equipment_id)),
    [scopeInspections]
  );

  const totalMasterlistCount = filteredMasterlist.length;
  const inspectedMasterlist = useMemo(
    () => filteredMasterlist.filter((e) => inspectedEquipmentIds.has(e.id)),
    [filteredMasterlist, inspectedEquipmentIds]
  );
  const inspectedCount = inspectedMasterlist.length;
  const notInspectedCount = Math.max(0, totalMasterlistCount - inspectedCount);

  // ★ Uninspected equipment list from the masterlist
  const uninspectedRows = useMemo(() => {
    return filteredMasterlist
      .filter((e) => !inspectedEquipmentIds.has(e.id))
      .sort((a, b) => a.no_id.localeCompare(b.no_id));
  }, [filteredMasterlist, inspectedEquipmentIds]);

  // Reset pages when filters change
  const filterSignature = [searchQuery, selectedType, selectedEntity, selectedFacility, selectedMonth, selectedWeek].join('|');
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  if (prevFilterSignature !== filterSignature) {
    setPrevFilterSignature(filterSignature);
    setUnsafePage(1);
    setSafePage(1);
    setUninspPage(1);
    setReportPage(1);
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
  const reportSlice = useMemo(() => filteredInspections.slice((reportPage - 1) * PAGE_SIZE, reportPage * PAGE_SIZE), [filteredInspections, reportPage]);

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

  // Data is only shown once the user picks a period filter (month/week).
  const hasPeriodFilter = selectedMonth !== '' || selectedWeek !== '';

  // ── Print A4 inspection results via the form checklist templates ──
  const equipmentById = useMemo(() => new Map(masterlist.map((e) => [e.id, e])), [masterlist]);

  const runPrint = async (records: InspectionRecord[]) => {
    if (records.length === 0) return;
    setPrinting(true);
    try {
      // Build full equipment-joined records for all inspections so previous week matching works
      const allPrintRecords = inspections.map((r) => {
        const eq = equipmentById.get(r.equipment_id);
        return {
          ...r,
          equipment: {
            area: r.equipment?.area ?? eq?.area ?? null,
            location: r.equipment?.location ?? eq?.location ?? null,
            pic_1: eq?.pic_1 ?? null,
            pic_2: eq?.pic_2 ?? null,
          },
        };
      });

      // Target records to print
      const printRecords = records.map((r) => {
        const eq = equipmentById.get(r.equipment_id);
        return {
          ...r,
          equipment: {
            area: r.equipment?.area ?? eq?.area ?? null,
            location: r.equipment?.location ?? eq?.location ?? null,
            pic_1: eq?.pic_1 ?? null,
            pic_2: eq?.pic_2 ?? null,
          },
        };
      });

      // Pre-fetch digital signatures for all inspectors in target + previous week records
      const inspectorNames = Array.from(
        new Set(allPrintRecords.map((r) => r.inspector_name).filter(Boolean))
      );
      const signatures: Record<string, string | null> = {};
      if (inspectorNames.length > 0) {
        const { data } = await supabase
          .from('pic')
          .select('name, signature_url')
          .in('name', inspectorNames);
        if (data) {
          data.forEach((p: { name: string; signature_url?: string | null }) => {
            if (p.name) signatures[p.name] = p.signature_url || null;
          });
        }
      }

      await printInspectionResults(printRecords, signatures, allPrintRecords);
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Print Error',
        message: err instanceof Error ? err.message : 'Failed to generate printable inspection results.',
        type: 'error',
      });
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintFiltered = () => {
    if (filteredInspections.length === 0) return;
    runPrint(filteredInspections);
  };

  const handlePrintSingle = (item: InspectionRecord) => {
    runPrint([item]);
  };

  const handlePrintReport = async () => {
    if (filteredInspections.length === 0) return;
    setPrintingReport(true);
    try {
      const recordsWithCapa = filteredInspections.map((r) => {
        const imp = improvementsMap.get(r.id) || null;
        return {
          ...r,
          improvement: imp ? {
            id: imp.id,
            issue_description: imp.issue_description,
            action_plan: imp.action_plan,
            action_taken: imp.action_taken,
            pic_name: imp.pic_name,
            target_date: imp.target_date,
            completion_date: imp.completion_date,
            status: imp.status,
            before_photo_url: imp.before_photo_url,
            after_photo_url: imp.after_photo_url,
          } : null,
        };
      });

      await printResultReport({
        records: recordsWithCapa,
        entity: selectedEntity === 'All' ? 'All Entities' : selectedEntity,
        facility: selectedFacility === 'All' ? 'All Facilities' : selectedFacility,
        period: periodText,
        safeCount,
        unsafeCount,
        resolvedCount,
        inProgressCount,
        openCount,
        passRate,
        healthScore,
      });
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Print Error',
        message: err instanceof Error ? err.message : 'Failed to generate printable result report.',
        type: 'error',
      });
    } finally {
      setPrintingReport(false);
    }
  };

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
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full mb-4 ${isUnsafe ? 'tone-emerald' : 'tone-sky'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isUnsafe ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="9" />}
              </svg>
            </div>
            <p className="text-sm">{isUnsafe ? 'Great news! No unsafe conditions found.' : 'No safe records match your filters.'}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="mobile-cards w-full text-left">
                <thead>
                  <tr className="border-b border-line bg-ink-950/40">
                    <th className="th">Equipment ID</th>
                    <th className="th">Type</th>
                    <th className="th">Entity / Facility</th>
                    <th className="th">Date / Period</th>
                    <th className="th">Inspector</th>
                    <th className="th">Remarks</th>
                    {isUnsafe && <th className="th">Improvement Status</th>}
                    <th className="th text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((item) => {
                    const entity   = item.equipment?.entity   ?? '';
                    const facility = item.equipment?.facility ?? '';
                    const imp = improvementsMap.get(item.id);
                    const impStatus = imp?.status || 'OPEN';
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setViewingRecord(item)}
                        className={`transition-colors cursor-pointer hover:bg-ink-700/10`}
                      >
                        <td data-label="Equipment ID" className={`td font-bold ${isUnsafe ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {item.equipment_no_id}
                        </td>
                        <td data-label="Type" className="td">
                          <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(item.equipment_type)}`}>
                            {item.equipment_type}
                          </span>
                        </td>
                        <td data-label="Entity / Facility" className="td text-xs">
                          {entity && <div className="text-ink-200 font-medium">{entity}</div>}
                          {facility && <div className="text-ink-500 text-[11px]">{facility}</div>}
                          {!entity && !facility && <span className="text-ink-600 italic">—</span>}
                        </td>
                        <td data-label="Date / Period" className="td text-xs text-ink-300">
                          <div>{item.inspection_date}</div>
                          <div className="text-ink-500 text-[11px]">{item.week} ({item.month_year})</div>
                        </td>
                        <td data-label="Inspector" className="td text-xs text-ink-200">{item.inspector_name}</td>
                        <td data-label="Remarks" className="td text-xs text-ink-400 max-w-[180px] truncate">
                          {item.remarks || <span className="italic text-ink-600">No remarks</span>}
                        </td>
                        {isUnsafe && (
                          <td data-label="CAPA Status" className="td text-xs">
                            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                impStatus === 'RESOLVED'
                                  ? 'tone-emerald'
                                  : impStatus === 'IN_PROGRESS'
                                  ? 'tone-amber'
                                  : 'tone-rose'
                              }`}>
                                {impStatus}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveImprovementInspection(item);
                                  setActiveExistingImprovement(imp || null);
                                }}
                                className="px-2 py-1 rounded bg-ink-800 hover:bg-ink-700 text-[11px] text-ink-200 border border-line font-medium shrink-0"
                              >
                                {imp ? 'Edit CAPA' : '+ Log Fix'}
                              </button>
                            </div>
                          </td>
                        )}
                        <td data-label="Action" className="td text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
                            {userRole === 'admin' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRecord(item);
                                }}
                                className="btn btn-ghost text-xs px-2.5 py-1 text-amber-400 hover:bg-amber-950/30 font-medium"
                                title="Edit this inspection log to correct human error (Admin Only)"
                              >
                                ✏️ Edit
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePrintSingle(item); }}
                              disabled={printing}
                              className={`btn btn-ghost text-xs px-2.5 py-1 ${isUnsafe ? 'text-rose-400 hover:bg-ink-700/20' : 'text-emerald-400 hover:bg-ink-700/20'}`}
                              title="Print A4 checklist for this inspection"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 6 2 18 2 18 9" />
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                <rect x="6" y="14" width="12" height="8" rx="1" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setViewingRecord(item); }}
                              className={`btn btn-ghost text-xs px-3 py-1 ${isUnsafe ? 'text-rose-400 hover:bg-ink-700/20' : 'text-emerald-400 hover:bg-ink-700/20'}`}
                            >
                              Details
                            </button>
                          </div>
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
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4 tone-emerald">
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
              <table className="mobile-cards w-full text-left">
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
                    <tr key={equip.id} className="transition-colors hover:bg-ink-700/10">
                      <td data-label="Equipment ID" className="td font-bold text-amber-400">{equip.no_id}</td>
                      <td data-label="Type" className="td">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(equip.type)}`}>
                          {equip.type}
                        </span>
                      </td>
                      <td data-label="Entity / Facility" className="td text-xs">
                        {equip.entity && <div className="text-ink-200 font-medium">{equip.entity}</div>}
                        {equip.facility && <div className="text-ink-500 text-[11px]">{equip.facility}</div>}
                        {!equip.entity && !equip.facility && <span className="text-ink-600 italic">—</span>}
                      </td>
                      <td data-label="Area / Location" className="td text-xs text-ink-300">
                        {[equip.area, equip.location].filter(Boolean).join(' · ') || (equip.area || '—')}
                      </td>
                      <td data-label="Status" className="td text-right">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border tone-amber">
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

  // ★ Professional Inspection Result Report table
  const renderReport = () => {
    const entityLabel = selectedEntity === 'All' ? 'All Entities' : selectedEntity;
    const facilityLabel = selectedFacility === 'All' ? 'All Facilities' : selectedFacility;

    return (
      <div>
        {loading ? (
          <div className="py-20 text-center text-ink-500 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500" />
            <p className="text-sm">Loading report…</p>
          </div>
        ) : reportSlice.length === 0 ? (
          <div className="py-16 text-center text-ink-500">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4 tone-sky">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-sm">No inspection results match your filters.</p>
          </div>
        ) : (
          <>
            {/* ── Report header: logo + entity/facility + period ── */}
            <div className="border-b border-line bg-ink-950/40 px-4 sm:px-5 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                {/* Logo + info */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logoyj.jpeg"
                    alt="Company logo"
                    className="h-10 w-10 sm:h-14 sm:w-14 rounded-xl border border-line bg-white object-contain p-1 shrink-0"
                    draggable={false}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-bold tracking-tight text-ink-100">Inspection Result Report</h3>
                    <p className="text-xs text-ink-400 mt-0.5">
                      <span className="font-semibold text-ember-500">{entityLabel}</span>
                      <span className="text-ink-500 mx-1.5">·</span>
                      <span className="font-semibold text-ink-200">{facilityLabel}</span>
                    </p>
                    <p className="text-[11px] text-ink-500 mt-0.5">
                      Period: <span className="text-ink-300">{periodText}</span> ·{' '}
                      <span className="text-ink-300">{totalInspections}</span> inspection results
                    </p>
                  </div>
                </div>
                {/* Health score + print */}
                <div className="flex flex-wrap items-center sm:items-end gap-2 sm:gap-3 shrink-0">
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${healthScore >= 80 ? 'tone-emerald' : 'tone-amber'}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {healthScore}% Pass Rate
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-ink-500 leading-tight">
                      {safeCount} PASS · {resolvedCount} Resolved · {inProgressCount} In Progress · {openCount} Needs Action
                    </span>
                  </div>
                  <button
                    onClick={handlePrintReport}
                    disabled={printingReport || !hasPeriodFilter || filteredInspections.length === 0}
                    className="btn btn-primary text-xs flex items-center gap-1.5 px-3 py-2"
                    title="Print professional result report (A4 landscape)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" rx="1" />
                    </svg>
                    {printingReport ? 'Preparing…' : `Print Report (${filteredInspections.length})`}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Report table with inspection photos & CAPA tracking ── */}
            <div className="overflow-x-auto w-full">
              {/* Desktop table — hidden on mobile, card layout below handles small screens */}
              <table className="mobile-cards w-full text-left">
                <thead className="hidden md:table-header-group">
                  <tr className="border-b border-line bg-ink-950/40">
                    <th className="th w-[115px] shrink-0">Photo</th>
                    <th className="th w-[105px]">Equipment ID</th>
                    <th className="th w-[120px]">Type</th>
                    <th className="th w-[130px]">Entity / Facility</th>
                    <th className="th w-[115px]">Date / Period</th>
                    <th className="th w-[105px]">Inspector</th>
                    <th className="th w-[135px]">Status / CAPA</th>
                    <th className="th min-w-[240px]">Findings &amp; Corrective Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {reportSlice.map((item) => {
                    const entity   = item.equipment?.entity   ?? '';
                    const facility = item.equipment?.facility ?? '';
                    const photos = (item.photo_url || '').split(',').map((p) => p.trim()).filter(Boolean);
                    const isPass = item.status === 'PASS';
                    const improvement = improvementsMap.get(item.id);
                    const beforePhoto = photos.length > 0 ? photos[0] : (improvement?.before_photo_url || null);
                    const afterPhoto = improvement?.after_photo_url || null;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setViewingRecord(item)}
                        className={`transition-colors cursor-pointer hover:bg-ink-700/10`}
                      >
                        <td data-label="Photo" className="td align-top">
                          <div className="flex items-center gap-1.5">
                            {beforePhoto ? (
                              <div className="relative group shrink-0">
                                <ProtectedImage
                                  src={beforePhoto}
                                  alt={`${item.equipment_no_id} inspection photo`}
                                  onPreview={() => setViewingRecord(item)}
                                  className="h-11 w-12 rounded-lg border border-line object-cover"
                                />
                                {afterPhoto && (
                                  <span className="absolute -bottom-1 -left-1 bg-rose-950/90 text-rose-300 border border-rose-800 text-[8px] font-bold px-1 rounded">
                                    Before
                                  </span>
                                )}
                              </div>
                            ) : !afterPhoto ? (
                              <span className="inline-flex h-11 w-12 items-center justify-center rounded-lg border border-line bg-ink-850 text-ink-600 shrink-0">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <rect x="3" y="3" width="18" height="18" rx="2" />
                                  <circle cx="9" cy="9" r="2" />
                                  <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
                                </svg>
                              </span>
                            ) : null}

                            {afterPhoto && (
                              <div className="relative group shrink-0">
                                <ProtectedImage
                                  src={afterPhoto}
                                  alt={`${item.equipment_no_id} fixed photo`}
                                  onPreview={() => setViewingRecord(item)}
                                  className="h-11 w-12 rounded-lg border border-emerald-500/50 object-cover"
                                />
                                <span className="absolute -bottom-1 -right-1 bg-emerald-950/90 text-emerald-300 border border-emerald-800 text-[8px] font-bold px-1 rounded">
                                  Fixed
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td data-label="Equipment ID" className={`td font-bold align-top ${isPass ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.equipment_no_id}
                        </td>
                        <td data-label="Type" className="td align-top">
                          <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${getTypeBadgeColor(item.equipment_type)}`}>
                            {item.equipment_type}
                          </span>
                        </td>
                        <td data-label="Entity / Facility" className="td text-xs align-top">
                          {entity && <div className="text-ink-200 font-medium">{entity}</div>}
                          {facility && <div className="text-ink-500 text-[11px]">{facility}</div>}
                          {!entity && !facility && <span className="text-ink-600 italic">—</span>}
                        </td>
                        <td data-label="Date / Period" className="td text-xs text-ink-300 align-top">
                          <div>{item.inspection_date}</div>
                          <div className="text-ink-500 text-[11px]">{item.week} ({item.month_year})</div>
                        </td>
                        <td data-label="Inspector" className="td text-xs text-ink-200 align-top">
                          {item.inspector_name}
                        </td>
                        <td data-label="Status / CAPA" className="td align-top">
                          {(() => {
                            if (!isPass) {
                              const capaStatus = improvement?.status || 'OPEN';
                              const capaResolved = capaStatus === 'RESOLVED';
                              const capaInProgress = capaStatus === 'IN_PROGRESS';
                              return (
                                <div className="flex flex-col gap-1.5 items-start md:items-start">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                                    capaResolved ? 'tone-emerald' : capaInProgress ? 'tone-amber' : 'tone-rose'
                                  }`}>
                                    {capaResolved ? (
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    ) : capaInProgress ? (
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                      </svg>
                                    ) : (
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                      </svg>
                                    )}
                                    {capaStatus}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveImprovementInspection(item);
                                      setActiveExistingImprovement(improvement || null);
                                    }}
                                    className="px-2 py-0.5 rounded bg-ink-800 hover:bg-ink-700 text-[10px] text-ink-200 border border-line font-medium shrink-0"
                                  >
                                    {improvement ? 'Edit CAPA' : '+ Log Fix'}
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tone-emerald whitespace-nowrap">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                PASS
                              </span>
                            );
                          })()}
                        </td>
                        <td data-label="Findings & Actions" className="td text-xs text-ink-400 align-top">
                          <div className="leading-snug">
                            {item.remarks ? (
                              <span className="text-ink-200">{item.remarks}</span>
                            ) : (
                              <span className="italic text-ink-600">No remarks</span>
                            )}
                          </div>
                          {improvement && (
                            <div className="mt-1.5 p-2 rounded-lg bg-ink-950/70 border border-line text-[11px] text-ink-300 space-y-1">
                              {(improvement.action_taken || improvement.action_plan) && (
                                <div className="break-words leading-tight">
                                  <strong className="text-ink-400">Action: </strong>
                                  <span className="text-ink-200">{improvement.action_taken || improvement.action_plan}</span>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ink-400 text-[10px] pt-0.5">
                                {improvement.pic_name && (
                                  <div>
                                    <strong className="text-ink-400">PIC: </strong>
                                    <span className="text-ink-300">{improvement.pic_name}</span>
                                  </div>
                                )}
                                {improvement.completion_date ? (
                                  <div className="text-emerald-400 font-medium">
                                    Done: {improvement.completion_date}
                                  </div>
                                ) : improvement.target_date ? (
                                  <div className="text-amber-400">
                                    Target: {improvement.target_date}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              total={filteredInspections.length}
              page={reportPage}
              pageSize={PAGE_SIZE}
              onChange={setReportPage}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="p-3 sm:p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* ── Header ── */}
          <div className="panel p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink-100">Inspection Reports</h1>
                <p className="text-xs text-ink-400 mt-0.5">
                  Monitor safety conditions and track equipment coverage within inspection periods.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {lastFetched && (
                  <span className="text-[11px] text-ink-600 hidden md:block">
                    Updated {lastFetched.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={handlePrintFiltered}
                  disabled={printing || !hasPeriodFilter || filteredInspections.length === 0}
                  className="btn btn-primary text-xs flex items-center gap-1.5 px-3 py-2"
                  title="Print A4 inspection results for the selected period"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" rx="1" />
                  </svg>
                  {printing ? 'Preparing…' : `Print Results (${filteredInspections.length})`}
                </button>
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
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-2 sm:gap-3">
              <div className="col-span-2 sm:col-span-1 sm:flex-1 sm:min-w-[140px]">
                <label className="field-label text-[10px]">Search</label>
                <input
                  type="text" value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ID, inspector, type…"
                  className="input text-xs"
                />
              </div>

              <div className="sm:flex-1 sm:min-w-[120px]">
                <label className="field-label text-[10px]">Entity</label>
                <select value={selectedEntity} onChange={(e) => { setSelectedEntity(e.target.value); setSelectedFacility('All'); }} className="input text-xs">
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
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <div>
                <label className="field-label text-[10px]">Month</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="input text-xs w-full sm:w-40">
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
                  className="input text-xs w-full sm:w-36"
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
                  <button onClick={clearDates} className="btn btn-ghost text-xs px-3 py-2 text-rose-400 hover:text-rose-600">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── KPI Cards ── */}
          {hasPeriodFilter ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2 sm:gap-4">
              <KpiCard label="Total Inspections" value={totalInspections} sub="In selected filters" color="text-ink-100" />
              <KpiCard label="Needs Attention"  value={openCount} sub="OPEN · needs action" color="text-rose-400" borderColor="border-rose-900/30" />
              <KpiCard
                label="Resolved (CAPA)"
                value={resolvedCount}
                sub="Corrective actions completed"
                color="text-emerald-400"
                borderColor="border-emerald-900/30"
              />
              <KpiCard
                label="In Progress (CAPA)"
                value={inProgressCount}
                sub="Corrective actions ongoing"
                color="text-amber-400"
                borderColor="border-amber-900/30"
              />
              <KpiCard label="Safe"             value={safeCount}   sub="PASS results"    color="text-emerald-400" borderColor="border-emerald-900/30" />
              <KpiCard
                label="Not Inspected"
                value={notInspectedCount}
                sub={`of ${totalMasterlistCount} total equipment`}
                color={notInspectedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}
                borderColor={notInspectedCount > 0 ? 'border-amber-900/30' : 'border-emerald-900/30'}
              />
              <PassRateRing rate={healthScore} addressed={resolvedCount + inProgressCount} />
            </div>
          ) : (
            <div className="panel">
              <FilterRequired scope="report metrics" />
            </div>
          )}

          {/* ── Coverage Breakdown ── */}
          <TypeBreakdown
            inspections={filteredInspections}
            masterlist={filteredMasterlist}
            periodText={periodText}
            hasPeriodFilter={hasPeriodFilter}
          />

          {/* ── Tabbed Table ── */}
          <div className="panel overflow-hidden p-0">
            {/* Tab bar */}
            <div className="flex overflow-x-auto border-b border-line bg-ink-950/40 scrollbar-none">
              <button
                onClick={() => setActiveTab('uninspected')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === 'uninspected' ? 'border-amber-500 text-amber-400' : 'border-transparent text-ink-500 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Uninspected Equipment
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'uninspected' ? 'tone-amber' : 'bg-ink-800 text-ink-500'}`}>
                  {hasPeriodFilter ? notInspectedCount : '–'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('unsafe')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === 'unsafe' ? 'border-rose-500 text-rose-400' : 'border-transparent text-ink-500 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Unsafe Conditions
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'unsafe' ? 'tone-rose' : 'bg-ink-800 text-ink-500'}`}>
                  {hasPeriodFilter ? unsafeCount : '–'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('safe')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === 'safe' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-ink-500 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                Safe Conditions
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'safe' ? 'tone-emerald' : 'bg-ink-800 text-ink-500'}`}>
                  {hasPeriodFilter ? safeCount : '–'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('report')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === 'report' ? 'border-sky-500 text-sky-400' : 'border-transparent text-ink-500 hover:text-ink-300'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
                </svg>
                Result Report
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'report' ? 'tone-sky' : 'bg-ink-800 text-ink-500'}`}>
                  {hasPeriodFilter ? totalInspections : '–'}
                </span>
              </button>
            </div>

            <div className={`px-3 sm:px-5 py-2.5 sm:py-3 text-[11px] sm:text-xs font-semibold uppercase tracking-wider border-b border-line bg-ink-700/10 ${
              activeTab === 'uninspected'
                ? 'text-amber-400'
                : activeTab === 'unsafe'
                  ? 'text-rose-400'
                  : activeTab === 'safe'
                    ? 'text-emerald-400'
                    : 'text-sky-400'
            }`}>
              {activeTab === 'uninspected'
                ? '⚠️ Masterlist equipment not yet inspected'
                : activeTab === 'unsafe'
                  ? '⚠️ Requires immediate follow-up'
                  : activeTab === 'safe'
                    ? '✅ Equipment in safe condition'
                    : '📄 Professional inspection result report with photos'}
            </div>

            {!hasPeriodFilter ? (
              <FilterRequired scope="inspection results" />
            ) : activeTab === 'uninspected'
              ? renderUninspectedTable()
              : activeTab === 'unsafe'
                ? renderTable(unsafeSlice, 'unsafe', unsafePage, setUnsafePage)
                : activeTab === 'safe'
                  ? renderTable(safeSlice,   'safe',   safePage,   setSafePage)
                  : renderReport()}
          </div>
        </div>
      </div>

      <InspectionDetailModal
        inspection={viewingRecord}
        onClose={() => setViewingRecord(null)}
        onEdit={(item) => setEditingRecord(item)}
      />

      {editingRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 md:p-6 bg-ink-950/80 backdrop-blur-md flex justify-center items-start animate-fade">
          <div className="relative w-full max-w-4xl bg-ink-900 border border-line rounded-3xl shadow-2xl p-6 my-auto sm:my-8">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
              <h2 className="text-xl font-bold text-ink-100 flex items-center gap-2">
                ✏️ Edit Inspection Log (Admin Mode)
              </h2>
              <button
                onClick={() => setEditingRecord(null)}
                className="text-ink-400 hover:text-ink-100 text-sm font-medium"
              >
                ✕ Close
              </button>
            </div>

            <InspectionForm
              editRecord={editingRecord}
              onSuccess={() => {
                setEditingRecord(null);
                setReloadTrigger((t) => t + 1);
              }}
              onCancel={() => setEditingRecord(null)}
            />
          </div>
        </div>
      )}

      {activeImprovementInspection && (
        <ImprovementModal
          inspection={activeImprovementInspection}
          existingImprovement={activeExistingImprovement}
          onClose={() => {
            setActiveImprovementInspection(null);
            setActiveExistingImprovement(null);
          }}
          onSuccess={() => setReloadTrigger((prev) => prev + 1)}
        />
      )}

      <AlertModal state={alertModal} onClose={() => setAlertModal(null)} />
    </>
  );
}
