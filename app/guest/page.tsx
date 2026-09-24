'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { getPeriodEndDate, equipmentExistsInPeriod } from '@/app/lib/equipmentPeriod';
import InspectionDetailModal, { InspectionRecord } from '@/app/components/inspection/InspectionDetailModal';
import InspectionChecklistModal from '@/app/components/inspection/InspectionChecklistModal';
import ProtectedImage from '@/app/components/ui/ProtectedImage';
import QRScannerModal from '@/app/components/ui/QRScannerModal';
import type { ImprovementRecord } from '@/app/components/inspection/ImprovementModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PicPerson {
  id?: string;
  name?: string;
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
  pic_1?: PicPerson | null;
  pic_2?: PicPerson | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'Fire Alarm': return 'bg-sky-50 text-sky-800 border-sky-200';
    case 'Fire Hydrant': return 'bg-cyan-50 text-cyan-800 border-cyan-200';
    case 'Fire Extinguisher': return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'Emergency Lamp': return 'bg-amber-50 text-amber-800 border-amber-200';
    default: return 'bg-stone-50 text-stone-600 border-stone-200';
  }
}

const EQUIPMENT_TYPES = [
  'Fire Extinguisher',
  'Fire Alarm',
  'Fire Hydrant',
  'Emergency Lamp',
];

const TYPE_COLORS: Record<string, string> = {
  'Fire Extinguisher': '#f97316',
  'Fire Alarm': '#ef4444',
  'Fire Hydrant': '#38bdf8',
  'Emergency Lamp': '#fbbf24',
};

function formatMonthYear(monthYear: string): string {
  const [mm, yyyy] = monthYear.split('/');
  const monthNum = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (!mm || isNaN(monthNum) || isNaN(year)) return monthYear;
  return `${new Date(Date.UTC(year, monthNum - 1)).toLocaleString('en-US', { month: 'long' })} ${year}`;
}

function CapaStatusBadge({ improvement }: { improvement?: ImprovementRecord | null }) {
  if (!improvement) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-50 text-stone-500 border border-stone-200 whitespace-nowrap">
        None
      </span>
    );
  }
  const resolved = improvement.status === 'RESOLVED';
  const inProgress = improvement.status === 'IN_PROGRESS';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${resolved
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : inProgress
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-rose-50 text-rose-700 border-rose-200'
        }`}
    >
      {resolved ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : inProgress ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )}
      {resolved ? 'RESOLVED' : inProgress ? 'IN PROGRESS' : 'OPEN'}
    </span>
  );
}

// Per-tab table color scheme (border line matches the active tab accent)
const TAB_SCHEME: Record<TabKey, {
  border: string;
  headerBg: string;
  divider: string;
  hover: string;
}> = {
  uninspected: {
    border: 'border-amber-200',
    headerBg: 'bg-amber-50/60',
    divider: 'divide-amber-100',
    hover: 'hover:bg-amber-50/50',
  },
  unsafe: {
    border: 'border-rose-200',
    headerBg: 'bg-rose-50/60',
    divider: 'divide-rose-100',
    hover: 'hover:bg-rose-50/50',
  },
  safe: {
    border: 'border-emerald-200',
    headerBg: 'bg-emerald-50/60',
    divider: 'divide-emerald-100',
    hover: 'hover:bg-emerald-50/50',
  },
  report: {
    border: 'border-sky-200',
    headerBg: 'bg-sky-50/60',
    divider: 'divide-sky-100',
    hover: 'hover:bg-sky-50/50',
  },
};

// PIC cell: profile image icon + name (falls back to initial avatar)
function PicCell({ pic, accent }: { pic?: PicPerson | null; accent: string }) {
  if (!pic?.name) {
    return <span className="text-[11px] italic text-stone-400">—</span>;
  }
  return (
    <div className="flex min-w-0 items-center gap-2" title={pic.name}>
      {pic.image_profile ? (
        <ProtectedImage
          src={pic.image_profile}
          alt=""
          className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${accent} text-[10px] font-bold`}>
          {pic.name[0].toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-xs text-stone-700">{pic.name}</span>
    </div>
  );
}

const PAGE_SIZE = 13;

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = 'uninspected' | 'unsafe' | 'safe' | 'report';

// Per-tab table color scheme (border line matches the active tab accent)

function KpiCard({
  label, value, sub, color = 'text-stone-900', borderColor = '',
}: {
  label: string; value: string | number; sub?: string;
  color?: string; borderColor?: string;
}) {
  return (
    <div className={`panel min-w-0 p-3 sm:p-4 lg:p-5 flex flex-col items-center justify-center text-center gap-1 ${borderColor}`}>
      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500 leading-tight">{label}</span>
      <span className={`text-2xl sm:text-3xl xl:text-4xl font-bold mt-1 break-words ${color}`}>{value}</span>
      {sub && <span className="text-[10px] sm:text-xs text-stone-500 mt-0.5 leading-snug break-words">{sub}</span>}
    </div>
  );
}

function PassRateRing({ rate, addressed = 0 }: { rate: number; addressed?: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  const color = rate >= 80 ? '#10b981' : rate >= 50 ? '#d97706' : '#dc2626';
  return (
    <div className="panel min-w-0 col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1 p-3 sm:p-4 lg:p-5 flex flex-col items-center justify-center gap-2 text-center">
      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-500 leading-tight">Health Score</span>
      <div className="relative flex items-center justify-center">
        <svg width="80" height="80" viewBox="0 0 96 96" className="h-20 w-20 sm:h-24 sm:w-24" aria-hidden="true">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#e7e5e4" strokeWidth="8" />
          <circle
            cx="48" cy="48" r={r}
            fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)' }}
          />
        </svg>
        <span className="absolute text-base sm:text-lg xl:text-xl font-bold break-words" style={{ color }}>{rate}%</span>
      </div>
      <span className="text-[10px] sm:text-xs text-stone-500 text-center leading-snug break-words">
        {addressed > 0 ? `${addressed} resolved or in progress via CAPA` : 'Pass rate + CAPA'}
      </span>
    </div>
  );
}

function FilterRequired({ scope = 'data' }: { scope?: string }) {
  return (
    <div className="px-4 sm:px-6 py-10 flex flex-col items-center justify-center text-center gap-2">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 text-stone-500">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      </span>
      <p className="text-sm text-stone-500 font-medium">Select a filter to view {scope}</p>
      <p className="text-xs text-stone-400 max-w-md">
        Choose a <strong className="text-stone-600">Month</strong> (and optionally <strong className="text-stone-600">Week</strong>) above to see inspection records for that period.
      </p>
    </div>
  );
}

function TypeBreakdown({
  inspections,
  masterlist,
  periodText,
}: {
  inspections: InspectionRecord[];
  masterlist: EquipmentMaster[];
  periodText: string;
}) {
  const [collapsed, setCollapsed] = useState(true);

  const inspectedIds = new Set(inspections.map((i) => i.equipment_id));
  const totalMasterlistAll = masterlist.length;
  const uniqueAllInspected = masterlist.filter((e) => inspectedIds.has(e.id)).length;
  const overallPending = Math.max(0, totalMasterlistAll - uniqueAllInspected);
  const overallCoverage = totalMasterlistAll > 0 ? Math.round((uniqueAllInspected / totalMasterlistAll) * 100) : 0;

  const rows = EQUIPMENT_TYPES.map((t) => {
    const typeMaster = masterlist.filter((e) => e.type === t);
    const totalEquip = typeMaster.length;
    const typeInspected = typeMaster.filter((e) => inspectedIds.has(e.id));
    const inspectedCount = typeInspected.length;
    const passCount = typeInspected.filter((e) =>
      inspections.some((i) => i.equipment_id === e.id && i.status === 'PASS')
    ).length;
    const notInspected = Math.max(0, totalEquip - inspectedCount);
    const passRate = inspectedCount > 0 ? Math.round((passCount / inspectedCount) * 100) : null;
    const coverage = totalEquip > 0 ? Math.round((inspectedCount / totalEquip) * 100) : null;

    return { type: t, totalEquip, inspectedCount, passCount, notInspected, passRate, coverage };
  }).filter((r) => r.totalEquip > 0 || r.inspectedCount > 0);

  if (rows.length === 0) return (
    <div className="p-4 sm:p-5 flex items-center justify-center text-stone-500 text-sm text-center">
      No equipment data available
    </div>
  );

  return (
    <div className="min-w-0 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="group flex min-w-0 items-start sm:items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <span className={`mt-0.5 sm:mt-0 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-100 text-stone-600 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex flex-wrap items-center gap-2">
              <span>Equipment Coverage Breakdown</span>
              <span className="text-[10px] font-normal px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 font-mono whitespace-nowrap">
                Period: {periodText}
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-stone-500 mt-1 leading-snug break-words">
              Masterlist total: <strong className="text-stone-900">{totalMasterlistAll}</strong> equipment · Inspected: <strong className="text-sky-700">{uniqueAllInspected}/{totalMasterlistAll} ({overallCoverage}%)</strong>
            </p>
          </div>
        </button>

        <div className="shrink-0">
          {overallPending === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              100% Fully Inspected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {overallPending} Equipment Pending Inspection
            </span>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="space-y-4 pt-1">
            {rows.map((r) => {
              const col = TYPE_COLORS[r.type] ?? '#8b91a0';
              const inspW = r.totalEquip > 0 ? (r.inspectedCount / r.totalEquip) * 100 : 0;
              const passW = r.inspectedCount > 0 ? (r.passCount / r.inspectedCount) * 100 : 0;

              return (
                <div key={r.type} className="min-w-0 space-y-1.5">
                  <div className="flex flex-col gap-1.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-stone-800 font-semibold truncate min-w-0">{r.type}</span>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 sm:justify-end text-stone-500">
                      <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                        Inspected: <strong className="text-stone-900">{r.inspectedCount}</strong> / <span className="text-stone-600">{r.totalEquip} Masterlist Total</span>
                      </span>
                      {r.passRate !== null && (
                        <span style={{ color: col }} className="font-bold">{r.passRate}% PASS</span>
                      )}
                      {r.notInspected > 0 ? (
                        <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                          {r.notInspected} Not Yet Inspected
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                          ✓ Complete
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative h-3 w-full max-w-full rounded-full bg-stone-200 overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                      style={{ width: `${inspW}%`, backgroundColor: `${col}40`, maxWidth: '100%' }}
                    />
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                      style={{ width: `${(inspW * passW) / 100}%`, backgroundColor: col, maxWidth: '100%' }}
                    />
                  </div>

                  <div className="flex flex-col gap-0.5 text-[11px] text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                    <span>
                      {r.coverage}% of total masterlist equipment inspected in this period
                    </span>
                    {r.notInspected > 0 && (
                      <span className="text-amber-600">
                        {r.notInspected} equipment remaining for this period
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {overallPending > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
              <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <p className="font-bold">Inspection Period Incomplete ({periodText})</p>
                <p className="mt-0.5 text-amber-700/80">
                  <strong>{overallPending} out of {totalMasterlistAll}</strong> masterlist equipment have not been inspected during this period.
                  Ensure all equipment items receive inspection.
                </p>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}



// ─── PIC 2 Area Performance Scorecard ───────────────────────────────────────────────
// Groups the in-scope masterlist by PIC 2 person and shows per-person KPIs:
// coverage, pass rate, CAPA status and health score for the selected period.

interface Pic2KpiRow {
  key: string;
  pic: PicPerson | null;
  areas: string[];
  totalEquip: number;
  inspectedCount: number;
  passEquip: number;
  unsafeInspections: number;
  openCount: number;
  resolvedCount: number;
  inProgressCount: number;
  notInspected: number;
  coverage: number;
  passRate: number | null;
  health: number;
  supportCount: number;
  selfCount: number;
  otherCount: number;
  supportPct: number | null;
  pairedPic1: PairedPic1[];
}

interface PairedPic1 {
  key: string;
  pic: PicPerson | null;
  equipCount: number;
  inspectionsDone: number;
}

function Pic2AreaKpi({
  inspections,
  masterlist,
  improvementsMap,
  periodText,
}: {
  inspections: InspectionRecord[];
  masterlist: EquipmentMaster[];
  improvementsMap: Map<string, ImprovementRecord>;
  periodText: string;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const inspByEquipment = useMemo(() => {
    const map = new Map<string, InspectionRecord[]>();
    for (const insp of inspections) {
      const arr = map.get(insp.equipment_id);
      if (arr) arr.push(insp);
      else map.set(insp.equipment_id, [insp]);
    }
    return map;
  }, [inspections]);

  const allRows: Pic2KpiRow[] = useMemo(() => {
    const groups = new Map<string, { pic: PicPerson | null; items: EquipmentMaster[] }>();
    for (const equip of masterlist) {
      const picId = equip.pic_2?.id?.trim() || '';
      const key = picId || `__unassigned__${(equip.pic_2?.name ?? '').toLowerCase() || 'none'}`;
      const entry = groups.get(key);
      if (entry) entry.items.push(equip);
      else groups.set(key, { pic: equip.pic_2 ?? null, items: [equip] });
    }

    const normName = (s?: string | null) => (s ?? '').trim().toLowerCase();
    const allPic1Names = new Set(
      masterlist.map((e) => normName(e.pic_1?.name)).filter((n) => n !== '')
    );

    const rows: Pic2KpiRow[] = [];
    for (const [key, { pic, items }] of groups) {
      const itemIds = new Set(items.map((e) => e.id));
      const grpInspections = inspections.filter((i) => itemIds.has(i.equipment_id));
      const inspectedIds = new Set(grpInspections.map((i) => i.equipment_id));
      const inspectedCount = items.filter((e) => inspectedIds.has(e.id)).length;
      const passEquip = items.filter((e) =>
        (inspByEquipment.get(e.id) ?? []).some((i) => i.status === 'PASS')
      ).length;
      const unsafeInspections = grpInspections.filter((i) => i.status !== 'PASS');
      const resolvedCount = unsafeInspections.filter((i) => improvementsMap.get(i.id)?.status === 'RESOLVED').length;
      const inProgressCount = unsafeInspections.filter((i) => improvementsMap.get(i.id)?.status === 'IN_PROGRESS').length;
      const openCount = unsafeInspections.filter((i) => {
        const imp = improvementsMap.get(i.id);
        return !imp || imp.status === 'OPEN';
      }).length;
      const safeCount = grpInspections.filter((i) => i.status === 'PASS').length;
      const totalInspections = grpInspections.length;
      const notInspected = Math.max(0, items.length - inspectedCount);
      const areas = Array.from(new Set(items.map((e) => e.area).filter(Boolean) as string[])).sort();

      // ★ PIC 1 support: whose name is on the inspection reports for this PIC 2's equipment?
      // The inspection form auto-fills the inspector from PIC 1 first, then PIC 2, so matching
      // inspector_name against the paired PIC names reveals how much support PIC 1 provided
      // within each PIC 2's coverage.
      const pic2Norm = normName(pic?.name);
      let supportCount = 0;
      let selfCount = 0;
      let otherCount = 0;
      const pairedMap = new Map<string, { pic: PicPerson | null; equipIds: Set<string> }>();
      for (const e of items) {
        const p1Id = e.pic_1?.id?.trim() || '';
        const p1Key = p1Id || `__nop1__${normName(e.pic_1?.name)}`;
        const slot = pairedMap.get(p1Key);
        if (slot) slot.equipIds.add(e.id);
        else pairedMap.set(p1Key, { pic: e.pic_1 ?? null, equipIds: new Set([e.id]) });
      }
      const pairedDone = new Map<string, number>();
      for (const insp of grpInspections) {
        const inspNorm = normName(insp.inspector_name);
        if (inspNorm !== '' && inspNorm === pic2Norm) {
          selfCount += 1;
        } else if (inspNorm !== '' && allPic1Names.has(inspNorm)) {
          supportCount += 1;
          const matchKey = [...pairedMap.keys()].find((k) => normName(pairedMap.get(k)?.pic?.name) === inspNorm);
          if (matchKey) pairedDone.set(matchKey, (pairedDone.get(matchKey) ?? 0) + 1);
        } else {
          otherCount += 1;
        }
      }
      const pairedPic1: PairedPic1[] = [...pairedMap.entries()]
        .map(([k, v]) => ({
          key: k,
          pic: v.pic,
          equipCount: v.equipIds.size,
          inspectionsDone: pairedDone.get(k) ?? 0,
        }))
        .sort((a, b) => b.inspectionsDone - a.inspectionsDone || b.equipCount - a.equipCount);

      rows.push({
        key,
        pic,
        areas,
        totalEquip: items.length,
        inspectedCount,
        passEquip,
        unsafeInspections: unsafeInspections.length,
        openCount,
        resolvedCount,
        inProgressCount,
        notInspected,
        coverage: items.length > 0 ? Math.round((inspectedCount / items.length) * 100) : 0,
        passRate: inspectedCount > 0 ? Math.round((passEquip / inspectedCount) * 100) : null,
        health: totalInspections > 0
          ? Math.round(((safeCount + resolvedCount + inProgressCount) / totalInspections) * 100)
          : 100,
        supportCount,
        selfCount,
        otherCount,
        supportPct: totalInspections > 0 ? Math.round((supportCount / totalInspections) * 100) : null,
        pairedPic1,
      });
    }
    return rows;
  }, [masterlist, inspections, inspByEquipment, improvementsMap]);

  // Default order: most PIC 1 support first.
  const rows = useMemo(() => {
    return [...allRows].sort(
      (a, b) => (b.supportPct ?? -1) - (a.supportPct ?? -1) || b.notInspected - a.notInspected
    );
  }, [allRows]);

  const totalPic2 = allRows.length;
  const totalPending = allRows.reduce((s, r) => s + r.notInspected, 0);
  const totalOpen = allRows.reduce((s, r) => s + r.openCount, 0);
  const totalSupport = allRows.reduce((s, r) => s + r.supportCount, 0);
  const totalSelf = allRows.reduce((s, r) => s + r.selfCount, 0);
  const totalOther = allRows.reduce((s, r) => s + r.otherCount, 0);
  const totalPerformed = totalSupport + totalSelf + totalOther;

  if (allRows.length === 0) {
    return (
      <div className="p-4 sm:p-5 flex items-center justify-center text-stone-500 text-sm text-center">
        No PIC 2 data available
      </div>
    );
  }

  return (
    <div className="min-w-0 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="group flex min-w-0 items-start sm:items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <span className={`mt-0.5 sm:mt-0 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-100 text-stone-600 transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex flex-wrap items-center gap-2">
              <span>PIC 2 Area Performance</span>
              <span className="text-[10px] font-normal px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 font-mono whitespace-nowrap">
                Period: {periodText}
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-stone-500 mt-1 leading-snug break-words">
              <strong className="text-stone-900">{totalPic2}</strong> PIC 2 responsible ·{' '}
              <strong className={totalPending > 0 ? 'text-amber-700' : 'text-emerald-700'}>{totalPending} pending</strong> ·{' '}
              <strong className={totalOpen > 0 ? 'text-rose-700' : 'text-stone-700'}>{totalOpen} needs action</strong> ·{' '}
              <strong className="text-sky-700">{totalSupport} supported by PIC 1</strong>
            </p>
          </div>
        </button>

        <div className="shrink-0">
          {totalPending === 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              All PIC 2 Areas Covered
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {totalPending} Equipment Pending
            </span>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {totalPerformed > 0 && (
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                  Inspection performer mix
                </span>
                <span className="text-[11px] text-stone-500">{totalPerformed} inspections in selected scope</span>
              </div>
              <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
                <div className="h-full bg-sky-500 transition-all duration-500" style={{ width: `${(totalSupport / totalPerformed) * 100}%` }} />
                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(totalSelf / totalPerformed) * 100}%` }} />
                <div className="h-full bg-stone-400 transition-all duration-500" style={{ width: `${(totalOther / totalPerformed) * 100}%` }} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                  PIC 1 support <strong className="text-stone-900">{totalSupport}</strong>
                  <span className="text-stone-400">({Math.round((totalSupport / totalPerformed) * 100)}%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Performed by PIC 2 <strong className="text-stone-900">{totalSelf}</strong>
                  <span className="text-stone-400">({Math.round((totalSelf / totalPerformed) * 100)}%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-stone-400" />
                  Other inspectors <strong className="text-stone-900">{totalOther}</strong>
                  <span className="text-stone-400">({Math.round((totalOther / totalPerformed) * 100)}%)</span>
                </span>
              </div>
            </div>
          )}

            <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:-mx-5 sm:px-5">
              <table className="mobile-cards w-full text-left min-w-[720px] md:min-w-[900px]">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/60">
                    <th className="th">PIC 2</th>
                    <th className="th">Areas</th>
                    <th className="th text-center">Total</th>
                    <th className="th">Coverage</th>
                    <th className="th text-center">PASS</th>
                    <th className="th text-center">Needs Action</th>
                    <th className="th text-center">Pending</th>
                    <th className="th text-center">Health</th>
                    <th className="th text-center">PIC 1 Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((r) => {
                    const healthColor = r.health >= 80
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : r.health >= 50
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200';
                    return (
                      <React.Fragment key={r.key}>
                        <tr className="transition-colors hover:bg-stone-50/60">
                          <td data-label="PIC 2" className="td">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => setExpandedKey((k) => (k === r.key ? null : r.key))}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-500 hover:text-sky-700 hover:border-sky-300"
                                title={expandedKey === r.key ? 'Hide PIC 1 support detail' : 'Show PIC 1 support detail'}
                                aria-expanded={expandedKey === r.key}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${expandedKey === r.key ? 'rotate-90' : ''}`}>
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </button>
                              <PicCell pic={r.pic} accent="border-stone-200 text-stone-600 bg-stone-100" />
                            </div>
                          </td>
                          <td data-label="Areas" className="td text-xs text-stone-600">
                            {r.areas.length > 0 ? (
                              <span className="block max-w-[220px] truncate" title={r.areas.join(', ')}>
                                {r.areas.join(', ')}
                              </span>
                            ) : (
                              <span className="italic text-stone-400">—</span>
                            )}
                          </td>
                          <td data-label="Total" className="td text-center text-xs font-bold text-stone-800">
                            {r.totalEquip}
                          </td>
                          <td data-label="Coverage" className="td">
                            <div className="flex items-center gap-2 min-w-[130px]">
                              <div className="relative h-2 flex-1 rounded-full bg-stone-200 overflow-hidden">
                                <div
                                  className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${r.coverage === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                                  style={{ width: `${r.coverage}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-stone-700 whitespace-nowrap">
                                {r.inspectedCount}/{r.totalEquip} · {r.coverage}%
                              </span>
                            </div>
                            {r.passRate !== null && (
                              <span className="text-[11px] text-stone-500">{r.passRate}% pass ({r.passEquip} equip)</span>
                            )}
                          </td>
                          <td data-label="PASS" className="td text-center">
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {r.passEquip}
                            </span>
                          </td>
                          <td data-label="Needs Action" className="td text-center">
                            {r.openCount > 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                {r.openCount} OPEN
                              </span>
                            ) : r.unsafeInspections > 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ CAPA done
                              </span>
                            ) : (
                              <span className="text-[11px] text-stone-400">—</span>
                            )}
                            {(r.resolvedCount + r.inProgressCount) > 0 && (
                              <div className="text-[10px] text-stone-500 mt-0.5">
                                {r.resolvedCount} resolved · {r.inProgressCount} in progress
                              </div>
                            )}
                          </td>
                          <td data-label="Pending" className="td text-center">
                            {r.notInspected > 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {r.notInspected} pending
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ Complete
                              </span>
                            )}
                          </td>
                          <td data-label="Health" className="td text-center">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${healthColor}`}>
                              {r.health}%
                            </span>
                          </td>
                          <td data-label="PIC 1 Support" className="td text-center">
                            {r.supportPct === null ? (
                              <span className="text-[11px] text-stone-400">—</span>
                            ) : (
                              <div className="flex flex-col items-center gap-1 min-w-[120px]">
                                {(() => {
                                  const total = r.supportCount + r.selfCount + r.otherCount;
                                  const seg = (n: number) => (total > 0 ? `${(n / total) * 100}%` : '0%');
                                  return (
                                    <div
                                      className="flex h-2 w-full max-w-[150px] rounded-full overflow-hidden bg-stone-200"
                                      title={`${r.supportCount} supported by PIC 1 · ${r.selfCount} by PIC 2 · ${r.otherCount} by others`}
                                    >
                                      <div className="h-full bg-sky-500" style={{ width: seg(r.supportCount) }} />
                                      <div className="h-full bg-emerald-500" style={{ width: seg(r.selfCount) }} />
                                      <div className="h-full bg-stone-400" style={{ width: seg(r.otherCount) }} />
                                    </div>
                                  );
                                })()}
                                <span className="text-[11px] font-bold text-sky-700 whitespace-nowrap">
                                  {r.supportPct}% supported ({r.supportCount})
                                </span>
                                <span className="text-[10px] text-stone-500 whitespace-nowrap">
                                  {r.selfCount} by PIC 2 · {r.otherCount} others
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                        {expandedKey === r.key && (
                          <tr className="bg-sky-50/40">
                            <td colSpan={9} className="td">
                              <div className="rounded-xl border border-sky-200 bg-white p-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1">
                                  PIC 1 support detail — {r.pic?.name ?? 'Unassigned'}
                                </p>
                                <p className="text-[11px] text-stone-500 mb-2.5">
                                  Bar shows inspections each paired PIC 1 performed within this PIC 2&apos;s area
                                  <span className="mx-1.5 text-stone-300">|</span>
                                  <span className="inline-block h-2 w-2 rounded-full bg-sky-500 align-middle" /> PIC 1
                                  <span className="mx-1 text-stone-300">·</span>
                                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" /> PIC 2 self
                                  <span className="mx-1 text-stone-300">·</span>
                                  <span className="inline-block h-2 w-2 rounded-full bg-stone-400 align-middle" /> others
                                </p>
                                {(() => {
                                  const maxDone = Math.max(1, ...r.pairedPic1.map((p) => p.inspectionsDone));
                                  return (
                                    <div className="space-y-2">
                                      {r.pairedPic1.map((p) => (
                                        <div key={p.key} className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-xs">
                                          <div className="min-w-0 sm:w-52 shrink-0">
                                            {p.pic?.name ? (
                                              <PicCell pic={p.pic} accent="border-sky-200 text-sky-700 bg-sky-50" />
                                            ) : (
                                              <span className="text-[11px] italic text-stone-400">No PIC 1 assigned</span>
                                            )}
                                          </div>
                                          <div className="flex flex-1 items-center gap-2 min-w-0">
                                            <div className="relative h-2 flex-1 rounded-full bg-stone-200 overflow-hidden">
                                              <div
                                                className="absolute left-0 top-0 h-full rounded-full bg-sky-500 transition-all duration-500"
                                                style={{ width: `${(p.inspectionsDone / maxDone) * 100}%` }}
                                              />
                                            </div>
                                            <span className="text-[11px] text-stone-600 whitespace-nowrap">
                                              <strong className="text-stone-900">{p.inspectionsDone}</strong> inspections · {p.equipCount} equip paired
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
        </>
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
    <div className="flex flex-col items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-t border-stone-200 bg-stone-50/60 md:flex-row">
      <span className="text-[11px] sm:text-xs text-stone-500 text-center md:text-left break-words">
        {total === 0 ? '0 results' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="min-h-[32px] px-2.5 py-1.5 rounded-lg text-xs text-stone-500 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          ‹ Prev
        </button>
        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`e${idx}`} className="px-1.5 text-stone-400 text-xs">…</span>
          ) : (
            <button key={p} onClick={() => onChange(p as number)}
              className={`min-h-[32px] min-w-[28px] px-1.5 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-red-800 text-white hover:bg-red-800' : 'text-stone-500 hover:bg-stone-200'}`}>
              {p}
            </button>
          )
        )}
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages}
          className="min-h-[32px] px-2.5 py-1.5 rounded-lg text-xs text-stone-500 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Next ›
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GuestReportsPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-8 text-stone-500 text-sm">Loading reports…</div>}>
      <GuestReportsInner />
    </Suspense>
  );
}

function GuestReportsInner() {
  const searchParams = useSearchParams();
  const supabase = getSupabaseClient();

  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [masterlist, setMasterlist] = useState<EquipmentMaster[]>([]);
  const [improvementsMap, setImprovementsMap] = useState<Map<string, ImprovementRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [viewingRecord, setViewingRecord] = useState<InspectionRecord | null>(null);
  const [viewingChecklist, setViewingChecklist] = useState<InspectionRecord | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Filters (initialized from URL query params)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [selectedType, setSelectedType] = useState(() => {
    const t = searchParams.get('type');
    return t && (t === 'All' || EQUIPMENT_TYPES.includes(t)) ? t : 'All';
  });
  const [selectedEntity, setSelectedEntity] = useState(searchParams.get('entity') ?? 'All');
  const [selectedFacility, setSelectedFacility] = useState(searchParams.get('facility') ?? 'All');
  const [selectedMonth, setSelectedMonth] = useState(searchParams.get('month') ?? '');
  const [selectedWeek, setSelectedWeek] = useState(searchParams.get('week') ?? '');

  // Tab & pagination
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const t = searchParams.get('tab');
    return t === 'unsafe' || t === 'safe' || t === 'uninspected' || t === 'report' ? t : 'uninspected';
  });
  const [unsafePage, setUnsafePage] = useState(1);
  const [safePage, setSafePage] = useState(1);
  const [uninspPage, setUninspPage] = useState(1);
  const [reportPage,    setReportPage]    = useState(1);
  const [coverageTab, setCoverageTab] = useState<'breakdown' | 'pic2'>('breakdown');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // ── Keep URL in sync with filters (external system update) ──
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedEntity !== 'All') params.set('entity', selectedEntity);
    if (selectedFacility !== 'All') params.set('facility', selectedFacility);
    if (selectedType !== 'All') params.set('type', selectedType);
    if (selectedMonth) params.set('month', selectedMonth);
    if (selectedWeek) params.set('week', selectedWeek);
    if (activeTab !== 'uninspected') params.set('tab', activeTab);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [searchQuery, selectedEntity, selectedFacility, selectedType, selectedMonth, selectedWeek, activeTab]);

  // ── Derived filter options from masterlist ──
  const uniqueEntities = useMemo(() => ['All', ...Array.from(new Set(masterlist.map(e => e.entity).filter(Boolean) as string[])).sort()], [masterlist]);
  const uniqueFacilities = useMemo(() => {
    const base = masterlist.filter(m => selectedEntity === 'All' || m.entity === selectedEntity);
    return ['All', ...Array.from(new Set(base.map(m => m.facility).filter(Boolean) as string[])).sort()];
  }, [masterlist, selectedEntity]);

  const monthOptions = useMemo(() => {
    return Array.from(new Set(inspections.map((i) => i.month_year).filter(Boolean))).sort().reverse();
  }, [inspections]);

  const weekOptions = useMemo(() => {
    const base = inspections.filter((i) => i.month_year === selectedMonth);
    return Array.from(new Set(base.map((i) => i.week).filter(Boolean)))
      .sort((a, b) => parseInt(a) - parseInt(b));
  }, [inspections, selectedMonth]);

  // ── Fetch (guest: no auth required) ──
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [inspRes, masterRes, impRes] = await Promise.all([
        supabase
          .from('inspections')
          .select(`*, equipment:equipment_id(location, facility, area, entity, pic_1:pic_1_id(id, name, phone, image_profile, image_contact), pic_2:pic_2_id(id, name, phone, image_profile, image_contact))`)
          .order('created_at', { ascending: false }),
        supabase
          .from('equipment')
          .select('id, no_id, type, entity, facility, area, location, created_at, start_date, pic_1:pic_1_id(id, name, phone, image_profile, image_contact), pic_2:pic_2_id(id, name, phone, image_profile, image_contact)'),
        supabase
          .from('improvements')
          .select('*')
      ]);

      if (!inspRes.error && inspRes.data) setInspections(inspRes.data as InspectionRecord[]);
      if (!masterRes.error && masterRes.data) setMasterlist(masterRes.data as EquipmentMaster[]);

      const map = new Map<string, ImprovementRecord>();
      if (impRes.data) {
        (impRes.data as ImprovementRecord[]).forEach((imp) => map.set(imp.inspection_id, imp));
      }
      setImprovementsMap(map);

      setLastFetched(new Date());
      setLoading(false);
    };

    fetchData();
  }, [supabase, reloadTrigger]);

  // ── QR code scan: resolve equipment and open its latest inspection ──
  const handleQrScan = (scanned: string) => {
    setShowQrScanner(false);
    setQrError(null);

    let value = scanned.trim();

    // Some scanners return the payload URL-encoded; normalize it first.
    try {
      const decoded = decodeURIComponent(value);
      if (decoded !== value) value = decoded.trim();
    } catch {
      // keep original value if decoding fails
    }

    const lower = value.toLowerCase();

    // Legacy ID tags encoded "{TYPE}-{no_id}" (e.g. "APAR-D1-001"), newer ones
    // encode the equipment's UUID directly. no_id in the masterlist is just "D1-001".
    const LEGACY_PREFIXES = ['apar', 'alarm', 'hydrant', 'emergency', 'exit'];

    const match =
      masterlist.find((e) => e.id === value) ||
      masterlist.find((e) => e.no_id.toLowerCase() === lower) ||
      masterlist.find((e) => {
        const noId = e.no_id.toLowerCase();
        return LEGACY_PREFIXES.some((p) => lower === `${p}-${noId}`) || lower.endsWith(`-${noId}`);
      });

    if (!match) {
      setQrError(`No equipment found for scanned code: "${value.slice(0, 50)}". Try again or search manually.`);
      return;
    }

    // Show the latest inspection for this equipment in the filled checklist template
    const latestInspection = inspections.find((i) => i.equipment_id === match.id);
    if (latestInspection) {
      setViewingChecklist(latestInspection);
    } else {
      setQrError(`No inspection recorded yet for "${match.no_id}". Shown below in the uninspected list.`);
      setSearchQuery(match.no_id);
      setActiveTab('uninspected');
    }
  };

  // ── Apply filters to inspections ──
  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      const matchSearch =
        item.equipment_no_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.inspector_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.equipment_type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType = selectedType === 'All' || item.equipment_type === selectedType;
      const entity = item.equipment?.entity ?? '';
      const facility = item.equipment?.facility ?? '';
      const matchEntity = selectedEntity === 'All' || entity === selectedEntity;
      const matchFacility = selectedFacility === 'All' || facility === selectedFacility;

      const matchMonth = !selectedMonth || item.month_year === selectedMonth;
      const matchWeek = !selectedWeek || item.week === selectedWeek;

      return matchSearch && matchType && matchEntity && matchFacility && matchMonth && matchWeek;
    });
  }, [inspections, searchQuery, selectedType, selectedEntity, selectedFacility, selectedMonth, selectedWeek]);

  // ── Apply same filters to masterlist for coverage ──
  // Equipment added to the masterlist AFTER the selected period is excluded, so new
  // equipment never inflates the "uninspected" count of past periods.
  // With "All Weeks" active, the cut-off is the latest week that actually has inspection data.
  const periodEndDate = useMemo(
    () => getPeriodEndDate(selectedMonth, selectedWeek, weekOptions),
    [selectedMonth, selectedWeek, weekOptions]
  );
  const filteredMasterlist = useMemo(() => {
    return masterlist.filter((m) => {
      const matchType = selectedType === 'All' || m.type === selectedType;
      const matchEntity = selectedEntity === 'All' || m.entity === selectedEntity;
      const matchFacility = selectedFacility === 'All' || m.facility === selectedFacility;
      return matchType && matchEntity && matchFacility && equipmentExistsInPeriod(m, periodEndDate);
    });
  }, [masterlist, selectedType, selectedEntity, selectedFacility, periodEndDate]);

  const unsafeRows = useMemo(() => filteredInspections.filter(i => i.status !== 'PASS'), [filteredInspections]);
  const safeRows = useMemo(() => filteredInspections.filter(i => i.status === 'PASS'), [filteredInspections]);
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
  const safeCount = safeRows.length;
  const unsafeCount = unsafeRows.length;
  const healthScore = totalInspections > 0
    ? Math.round(((safeCount + resolvedCount + inProgressCount) / totalInspections) * 100)
    : 100;

  const periodText = useMemo(() => {
    if (selectedMonth && selectedWeek) return `Week ${selectedWeek} · ${formatMonthYear(selectedMonth)}`;
    if (selectedMonth) return formatMonthYear(selectedMonth);
    return 'All Recorded Dates';
  }, [selectedMonth, selectedWeek]);

  const hasPeriodFilter = selectedMonth !== '' || selectedWeek !== '';

  // ── Coverage / "Not inspected" ──
  // Inspected scope matches the masterlist scope (type/entity/facility) PLUS the selected
  // period (month/week), so "inspected" only counts equipment that was inspected during the
  // selected week. This keeps the "not inspected" count accurate per week without mutating
  // or affecting any previously saved inspection/report data.
  const scopeInspections = useMemo(() => {
    return inspections.filter((item) => {
      const matchType = selectedType === 'All' || item.equipment_type === selectedType;
      const entity = item.equipment?.entity ?? '';
      const facility = item.equipment?.facility ?? '';
      const matchEntity = selectedEntity === 'All' || entity === selectedEntity;
      const matchFacility = selectedFacility === 'All' || facility === selectedFacility;
      const matchMonth = !selectedMonth || item.month_year === selectedMonth;
      const matchWeek = !selectedWeek || item.week === selectedWeek;
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
    () => filteredMasterlist.filter((m) => inspectedEquipmentIds.has(m.id)),
    [filteredMasterlist, inspectedEquipmentIds]
  );
  const inspectedCount = inspectedMasterlist.length;
  const notInspectedCount = Math.max(0, totalMasterlistCount - inspectedCount);

  // ★ Uninspected equipment list from the masterlist
  const uninspectedRows = useMemo(() => {
    return filteredMasterlist
      .filter((m) => !inspectedEquipmentIds.has(m.id))
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
  // ── Pagination slices ──
  const unsafeSlice = useMemo(() => unsafeRows.slice((unsafePage - 1) * PAGE_SIZE, unsafePage * PAGE_SIZE), [unsafeRows, unsafePage]);
  const safeSlice = useMemo(() => safeRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [safeRows, safePage]);
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

  // ─── Render ──────────────────────────────────────────────────────────────

  const renderInspectionTable = (rows: InspectionRecord[], scheme: TabKey) => {
    const s = TAB_SCHEME[scheme];
    const isUnsafe = scheme === 'unsafe';
    return (
      <div className="min-w-0">
        {loading ? (
          <div className="py-20 text-center text-stone-500 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-red-800" />
            <p className="text-sm">Loading reports…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center text-stone-500">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full mb-4 ${isUnsafe ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isUnsafe ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="9" />}
              </svg>
            </div>
            <p className="text-sm">{isUnsafe ? 'Great news! No unsafe conditions found.' : 'No safe records match your filters.'}</p>
          </div>
        ) : (
          <>
            <div className="w-full min-w-0 overflow-x-auto scrollbar-none">
              <table className={`mobile-cards w-full text-left border-b min-w-[720px] md:min-w-[960px] lg:min-w-0 lg:table-fixed ${s.border}`}>
                <thead>
                  <tr className={`border-b ${s.border} ${s.headerBg}`}>
                    <th className="th lg:w-[11%]">Equipment ID</th>
                    <th className="th lg:w-[9%]">Type</th>
                    <th className="th lg:w-[12%]">Entity / Facility</th>
                    <th className="th lg:w-[13%]">Area / Location</th>
                    <th className="th lg:w-[11%]">Date / Period</th>
                    <th className="th lg:w-[10%]">PIC 1</th>
                    <th className="th lg:w-[10%]">PIC 2</th>
                    {isUnsafe && <th className="th lg:w-[9%]">CAPA Status</th>}
                    <th className="th lg:w-[6%] text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${s.divider}`}>
                  {rows.map((item) => {
                    const entity = item.equipment?.entity ?? '';
                    const facility = item.equipment?.facility ?? '';
                    const accent = isUnsafe
                      ? 'border-rose-200 text-rose-700 bg-rose-50'
                      : 'border-emerald-200 text-emerald-700 bg-emerald-50';
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setViewingRecord(item)}
                        className={`transition-colors cursor-pointer ${s.hover}`}
                      >
                        <td data-label="Equipment ID" className={`td font-bold ${isUnsafe ? 'text-rose-700' : 'text-emerald-700'}`}>
                          <span className="block truncate">{item.equipment_no_id}</span>
                        </td>
                        <td data-label="Type" className="td">
                          <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(item.equipment_type)}`}>
                            {item.equipment_type}
                          </span>
                        </td>
                        <td data-label="Entity / Facility" className="td text-xs">
                          {entity && <div className="text-stone-800 font-medium truncate">{entity}</div>}
                          {facility && <div className="text-stone-500 text-[11px] truncate">{facility}</div>}
                          {!entity && !facility && <span className="text-stone-400 italic">—</span>}
                        </td>
                        <td data-label="Area / Location" className="td text-xs text-stone-600">
                          <span className="block truncate">
                            {[item.equipment?.area, item.equipment?.location].filter(Boolean).join(' · ') || (item.equipment?.area || '—')}
                          </span>
                        </td>
                        <td data-label="Date / Period" className="td text-xs text-stone-600">
                          <div className="truncate">{item.inspection_date}</div>
                          <div className="text-stone-400 text-[11px] truncate">{item.week} ({item.month_year})</div>
                        </td>
                        <td data-label="PIC 1" className="td">
                          <PicCell pic={item.equipment?.pic_1} accent={accent} />
                        </td>
                        <td data-label="PIC 2" className="td">
                          <PicCell pic={item.equipment?.pic_2} accent={accent} />
                        </td>
                        {isUnsafe && (
                          <td data-label="CAPA Status" className="td">
                            <CapaStatusBadge improvement={improvementsMap.get(item.id)} />
                          </td>
                        )}
                        <td data-label="Action" className="td text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewingRecord(item); }}
                            className={`btn btn-ghost min-h-[32px] text-xs px-3 py-1.5 whitespace-nowrap ${isUnsafe ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
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
    const s = TAB_SCHEME.uninspected;
    return (
      <div className="min-w-0">
        {loading ? (
          <div className="py-20 text-center text-stone-500 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-red-800" />
            <p className="text-sm">Loading equipment…</p>
          </div>
        ) : uninspSlice.length === 0 ? (
          <div className="px-4 py-16 text-center text-stone-500">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4 bg-emerald-50 text-emerald-600">
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
            <div className="w-full min-w-0 overflow-x-auto scrollbar-none">
              <table className={`mobile-cards w-full text-left border-b min-w-[680px] md:min-w-[860px] lg:min-w-0 lg:table-fixed ${s.border}`}>
                <thead>
                  <tr className={`border-b ${s.border} ${s.headerBg}`}>
                    <th className="th lg:w-[16%]">Equipment ID</th>
                    <th className="th lg:w-[13%]">Type</th>
                    <th className="th lg:w-[17%]">Entity / Facility</th>
                    <th className="th lg:w-[16%]">Area / Location</th>
                    <th className="th lg:w-[13%]">PIC 1</th>
                    <th className="th lg:w-[13%]">PIC 2</th>
                    <th className="th lg:w-[12%] text-right">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${s.divider}`}>
                  {uninspSlice.map((equip) => (
                    <tr key={equip.id} className={`transition-colors ${s.hover}`}>
                      <td data-label="Equipment ID" className="td font-bold text-amber-700">
                        <span className="block truncate">{equip.no_id}</span>
                      </td>
                      <td data-label="Type" className="td">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(equip.type)}`}>
                          {equip.type}
                        </span>
                      </td>
                      <td data-label="Entity / Facility" className="td text-xs">
                        {equip.entity && <div className="text-stone-800 font-medium truncate">{equip.entity}</div>}
                        {equip.facility && <div className="text-stone-500 text-[11px] truncate">{equip.facility}</div>}
                        {!equip.entity && !equip.facility && <span className="text-stone-400 italic">—</span>}
                      </td>
                      <td data-label="Area / Location" className="td text-xs text-stone-600">
                        <span className="block truncate">
                          {[equip.area, equip.location].filter(Boolean).join(' · ') || (equip.area || '—')}
                        </span>
                      </td>
                      <td data-label="PIC 1" className="td">
                        <PicCell pic={equip.pic_1} accent="border-amber-200 text-amber-700 bg-amber-50" />
                      </td>
                      <td data-label="PIC 2" className="td">
                        <PicCell pic={equip.pic_2} accent="border-amber-200 text-amber-700 bg-amber-50" />
                      </td>
                      <td data-label="Status" className="td text-right">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
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
      <div className="min-w-0">
        {loading ? (
          <div className="py-20 text-center text-stone-500 flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-red-800" />
            <p className="text-sm">Loading report…</p>
          </div>
        ) : reportSlice.length === 0 ? (
          <div className="px-4 py-16 text-center text-stone-500">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4 bg-sky-50 text-sky-600">
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
            <div className="border-b border-stone-200 bg-stone-50/60 px-4 sm:px-5 py-4">
              <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logoyj.jpeg"
                    alt="Company logo"
                    className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 rounded-xl border border-stone-200 bg-white object-contain p-1 shrink-0"
                    draggable={false}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold tracking-tight text-stone-900 break-words">Inspection Result Report</h3>
                    <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5 break-words">
                      <span className="font-semibold text-red-800">{entityLabel}</span>
                      <span className="text-stone-400 mx-1.5">·</span>
                      <span className="font-semibold text-stone-700">{facilityLabel}</span>
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5 break-words">
                      Period: <span className="text-stone-700">{periodText}</span> ·{' '}
                      <span className="text-stone-700">{totalInspections}</span> inspection results
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap sm:flex-row md:flex-col items-center md:items-end gap-1.5 sm:gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${healthScore >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {healthScore}% Pass Rate
                  </span>
                  <span className="text-[11px] text-stone-500 break-words md:text-right">
                    {safeCount} PASS · {resolvedCount} Resolved · {inProgressCount} In Progress · {openCount} Needs Action
                  </span>
                </div>
              </div>
            </div>

            {/* ── Report table with inspection photos ── */}
            <div className="w-full min-w-0 overflow-x-auto scrollbar-none">
              <table className="mobile-cards w-full text-left min-w-[720px] md:min-w-[940px] lg:min-w-[1024px]">
                <thead>
                  <tr className={`border-b ${TAB_SCHEME.report.border} ${TAB_SCHEME.report.headerBg}`}>
                    <th className="th">Photo</th>
                    <th className="th">Equipment ID</th>
                    <th className="th">Type</th>
                    <th className="th">Entity / Facility</th>
                    <th className="th">Date / Period</th>
                    <th className="th">Inspector</th>
                    <th className="th">Status</th>
                    <th className="th">Remarks</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${TAB_SCHEME.report.divider}`}>
                  {reportSlice.map((item) => {
                    const entity = item.equipment?.entity ?? '';
                    const facility = item.equipment?.facility ?? '';
                    const photos = (item.photo_url || '').split(',').map((p) => p.trim()).filter(Boolean);
                    const isPass = item.status === 'PASS';
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setViewingRecord(item)}
                        className={`transition-colors cursor-pointer ${isPass ? 'hover:bg-emerald-50/50' : 'hover:bg-rose-50/50'}`}
                      >
                        <td data-label="Photo" className="td">
                          {photos.length > 0 ? (
                            <ProtectedImage
                              src={photos[0]}
                              alt={`${item.equipment_no_id} inspection photo`}
                              onPreview={() => setViewingRecord(item)}
                              className="h-12 w-16 rounded-lg border border-stone-200 object-cover"
                            />
                          ) : (
                            <span className="inline-flex h-12 w-16 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-400">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="9" cy="9" r="2" />
                                <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
                              </svg>
                            </span>
                          )}
                        </td>
                        <td data-label="Equipment ID" className={`td font-bold ${isPass ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {item.equipment_no_id}
                        </td>
                        <td data-label="Type" className="td">
                          <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(item.equipment_type)}`}>
                            {item.equipment_type}
                          </span>
                        </td>
                        <td data-label="Entity / Facility" className="td text-xs">
                          {entity && <div className="text-stone-800 font-medium truncate">{entity}</div>}
                          {facility && <div className="text-stone-500 text-[11px] truncate">{facility}</div>}
                          {!entity && !facility && <span className="text-stone-400 italic">—</span>}
                        </td>
                        <td data-label="Date / Period" className="td text-xs text-stone-600">
                          <div className="truncate">{item.inspection_date}</div>
                          <div className="text-stone-400 text-[11px] truncate">{item.week} ({item.month_year})</div>
                        </td>
                        <td data-label="Inspector" className="td text-xs text-stone-700">{item.inspector_name}</td>
                        <td data-label="Status" className="td">
                          {(() => {
                            const improvement = improvementsMap.get(item.id);
                            const shownAsCapa = !isPass && !!improvement;
                            if (shownAsCapa) {
                              return <CapaStatusBadge improvement={improvement} />;
                            }
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isPass
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                {isPass ? (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                ) : (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                  </svg>
                                )}
                                {isPass ? 'PASS' : 'NEEDS ATTENTION'}
                              </span>
                            );
                          })()}
                        </td>
                        <td data-label="Remarks" className="td text-xs text-stone-500">
                          {item.remarks || <span className="italic text-stone-400">No remarks</span>}
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
    <div className="theme-light min-h-screen w-full overflow-x-clip bg-stone-100 text-stone-800">
      <div className="w-full p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-7xl min-w-0 space-y-4 sm:space-y-6">

          {/* ── Header ── */}
          <div className="panel min-w-0 p-4 sm:p-5 md:p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 break-words">Inspection Reports</h1>
                <p className="text-[11px] sm:text-xs text-stone-500 mt-1 leading-snug">
                  Public guest view. Monitor safety conditions, track equipment coverage, and see which equipment is still uninspected.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {lastFetched && (
                  <span className="text-[11px] text-stone-400 hidden sm:block">
                    Updated {lastFetched.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={() => { setLoading(true); setReloadTrigger((t) => t + 1); }} disabled={loading}
                  className="btn btn-ghost min-h-[36px] text-xs flex items-center gap-1.5 px-3 py-2"
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
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <div className="w-full min-w-0 sm:flex-1 sm:min-w-[160px] lg:min-w-[200px]">
                <label className="field-label text-[10px]">Search</label>
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="text" value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ID, inspector, type…"
                    className="input min-w-0 text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => { setQrError(null); setShowQrScanner(true); }}
                    className="btn btn-primary min-h-[38px] shrink-0 px-2.5 sm:px-3 py-2 text-xs flex items-center gap-1.5 whitespace-nowrap"
                    title="Scan an equipment ID tag QR code to view its latest inspection result"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <path d="M14 14h3v3h-3zM14 21h3M21 14h.01M21 21h.01" />
                    </svg>
                    <span className="hidden min-[380px]:inline">Scan QR</span>
                    <span className="min-[380px]:hidden">Scan</span>
                  </button>
                </div>
              </div>
              <div className="w-full min-w-0 sm:w-[calc(50%-4px)] lg:flex-1 lg:min-w-[140px]">
                <label className="field-label text-[10px]">Entity</label>
                <select value={selectedEntity} onChange={(e) => { const v = e.target.value; setSelectedEntity(v); if (v !== selectedEntity) setSelectedFacility('All'); }} className="input min-w-0 text-xs">
                  {uniqueEntities.map(e => <option key={e} value={e}>{e === 'All' ? 'All Entities' : e}</option>)}
                </select>
              </div>
              <div className="w-full min-w-0 sm:w-[calc(50%-4px)] lg:flex-1 lg:min-w-[140px]">
                <label className="field-label text-[10px]">Facility</label>
                <select value={selectedFacility} onChange={(e) => setSelectedFacility(e.target.value)} className="input min-w-0 text-xs">
                  {uniqueFacilities.map(f => <option key={f} value={f}>{f === 'All' ? 'All Facilities' : f}</option>)}
                </select>
              </div>
              <div className="w-full min-w-0 sm:flex-1 sm:min-w-[140px]">
                <label className="field-label text-[10px]">Equipment Type</label>
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="input min-w-0 text-xs">
                  <option value="All">All Types</option>
                  {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Filter row 2: month then week */}
            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <div className="w-full min-w-0 min-[420px]:w-[calc(50%-4px)] sm:w-auto">
                <label className="field-label text-[10px]">Month</label>
                <select value={selectedMonth} onChange={(e) => { const v = e.target.value; setSelectedMonth(v); if (v !== selectedMonth) setSelectedWeek(''); }} className="input min-w-0 text-xs w-full sm:w-40">
                  <option value="">All Months</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="w-full min-w-0 min-[420px]:w-[calc(50%-4px)] sm:w-auto">
                <label className="field-label text-[10px]">Week</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  disabled={!selectedMonth}
                  className="input min-w-0 text-xs w-full sm:w-36"
                >
                  <option value="">All Weeks</option>
                  {weekOptions.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 pb-0.5">
                <button onClick={setThisMonth} className="btn btn-ghost min-h-[36px] text-xs px-3 py-2 whitespace-nowrap">
                  This Month
                </button>
                {(selectedMonth || selectedWeek) && (
                  <button onClick={clearDates} className="btn btn-ghost min-h-[36px] text-xs px-3 py-2 text-rose-600 hover:text-rose-700 whitespace-nowrap">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {qrError && (
              <div className="flex min-w-0 items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 break-words">
                <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="min-w-0 flex-1 break-words">{qrError}</span>
                <button onClick={() => setQrError(null)} className="ml-auto shrink-0 text-rose-400 hover:text-rose-700 min-h-[24px] min-w-[24px]" title="Dismiss">✕</button>
              </div>
            )}
          </div>

          {/* ── KPI Cards ── */}
          {hasPeriodFilter ? (
            <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 lg:gap-4 xl:grid-cols-7">
              <KpiCard label="Total Inspections" value={totalInspections} sub="In selected filters" color="text-stone-900" />
              <KpiCard label="Needs Attention" value={openCount} sub="OPEN · needs action" color="text-rose-600" borderColor="border-rose-200" />
              <KpiCard
                label="Resolved (CAPA)"
                value={resolvedCount}
                sub="Corrective actions completed"
                color="text-emerald-600"
                borderColor="border-emerald-200"
              />
              <KpiCard
                label="In Progress (CAPA)"
                value={inProgressCount}
                sub="Corrective actions ongoing"
                color="text-amber-600"
                borderColor="border-amber-200"
              />
              <KpiCard label="Safe" value={safeCount} sub="PASS results" color="text-emerald-600" borderColor="border-emerald-200" />
              <KpiCard
                label="Not Inspected"
                value={notInspectedCount}
                sub={`of ${totalMasterlistCount} total equipment`}
                color={notInspectedCount > 0 ? 'text-amber-600' : 'text-emerald-600'}
                borderColor={notInspectedCount > 0 ? 'border-amber-200' : 'border-emerald-200'}
              />
              <PassRateRing rate={healthScore} addressed={resolvedCount + inProgressCount} />
            </div>
          ) : (
            <div className="panel min-w-0">
              <FilterRequired scope="coverage data" />
            </div>
          )}

          {/* ── Coverage & Performance (fused tabs) ── */}
          <div className="panel min-w-0 overflow-hidden p-0 mt-4 sm:mt-6">
            <div className="flex overflow-x-auto scrollbar-none border-b border-stone-200 bg-stone-50/60" role="tablist" aria-label="Coverage views">
              <button
                type="button"
                role="tab"
                aria-selected={coverageTab === 'breakdown'}
                onClick={() => setCoverageTab('breakdown')}
                className={`flex shrink-0 items-center gap-2 px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 text-[11px] sm:text-xs lg:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  coverageTab === 'breakdown' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M3 3v16a2 2 0 0 0 2 2h16" />
                  <line x1="8" y1="17" x2="8" y2="11" />
                  <line x1="13" y1="17" x2="13" y2="7" />
                  <line x1="18" y1="17" x2="18" y2="4" />
                </svg>
                <span className="hidden min-[420px]:inline">Equipment Coverage Breakdown</span>
                <span className="min-[420px]:hidden">Coverage</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={coverageTab === 'pic2'}
                onClick={() => setCoverageTab('pic2')}
                className={`flex shrink-0 items-center gap-2 px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 text-[11px] sm:text-xs lg:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                  coverageTab === 'pic2' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span className="hidden min-[420px]:inline">PIC 2 Area Performance</span>
                <span className="min-[420px]:hidden">PIC 2</span>
              </button>
            </div>

            {!hasPeriodFilter ? (
              <div className="p-0">
                <FilterRequired scope="coverage and performance data" />
              </div>
            ) : coverageTab === 'breakdown' ? (
              <TypeBreakdown
                inspections={scopeInspections}
                masterlist={filteredMasterlist}
                periodText={periodText}
              />
            ) : (
              <Pic2AreaKpi
                inspections={scopeInspections}
                masterlist={filteredMasterlist}
                improvementsMap={improvementsMap}
                periodText={periodText}
              />
            )}
          </div>

          {/* ── Tabbed Panel ── */}
          <div className="panel min-w-0 overflow-hidden p-0">
            <div className="flex overflow-x-auto scrollbar-none border-b border-stone-200 bg-stone-50/60" role="tablist" aria-label="Inspection records">
              <button
                onClick={() => setActiveTab('uninspected')}
                role="tab"
                aria-selected={activeTab === 'uninspected'}
                className={`flex shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 text-[11px] sm:text-xs lg:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === 'uninspected' ? 'border-amber-500 text-amber-700' : 'border-transparent text-stone-400 hover:text-stone-600'
                  }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="hidden min-[480px]:inline">Uninspected Equipment</span>
                <span className="min-[480px]:hidden">Uninspected</span>
                <span className={`text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold ${activeTab === 'uninspected' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                  {hasPeriodFilter ? notInspectedCount : '–'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('unsafe')}
                role="tab"
                aria-selected={activeTab === 'unsafe'}
                className={`flex shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 text-[11px] sm:text-xs lg:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === 'unsafe' ? 'border-rose-500 text-rose-600' : 'border-transparent text-stone-400 hover:text-stone-600'
                  }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="16" />
                </svg>
                <span className="hidden min-[480px]:inline">Unsafe Conditions</span>
                <span className="min-[480px]:hidden">Unsafe</span>
                <span className={`text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold ${activeTab === 'unsafe' ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-500'}`}>
                  {hasPeriodFilter ? unsafeCount : '–'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('safe')}
                role="tab"
                aria-selected={activeTab === 'safe'}
                className={`flex shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 text-[11px] sm:text-xs lg:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === 'safe' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-stone-400 hover:text-stone-600'
                  }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="hidden min-[480px]:inline">Safe Conditions</span>
                <span className="min-[480px]:hidden">Safe</span>
                <span className={`text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold ${activeTab === 'safe' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                  {hasPeriodFilter ? safeCount : '–'}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('report')}
                role="tab"
                aria-selected={activeTab === 'report'}
                className={`flex shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 text-[11px] sm:text-xs lg:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === 'report' ? 'border-sky-500 text-sky-700' : 'border-transparent text-stone-400 hover:text-stone-600'
                  }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" />
                </svg>
                <span className="hidden min-[480px]:inline">Result Report</span>
                <span className="min-[480px]:hidden">Report</span>
                <span className={`text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-bold ${activeTab === 'report' ? 'bg-sky-100 text-sky-700' : 'bg-stone-100 text-stone-500'}`}>
                  {hasPeriodFilter ? totalInspections : '–'}
                </span>
              </button>
            </div>

            {/* Active tab body */}
            {!hasPeriodFilter ? (
              <div className="p-0">
                <FilterRequired scope="inspection records" />
              </div>
            ) : activeTab === 'uninspected'
              ? renderUninspectedTable()
              : activeTab === 'safe'
                ? renderInspectionTable(safeSlice, 'safe')
                : activeTab === 'report'
                  ? renderReport()
                  : renderInspectionTable(unsafeSlice, 'unsafe')}
          </div>

          {/* ── Footer ── */}
          <footer className="px-4 pt-6 sm:pt-8 border-t border-stone-200 text-center">
            <p className="text-[11px] sm:text-xs text-stone-400 break-words">
              © 2026 Dev : <a href="https://garyyudo.site" target="_blank" rel="noopener noreferrer" className="text-stone-500 hover:text-red-800 font-medium transition-colors">Garyyudo.site</a>
            </p>
          </footer>
        </div>
      </div>

      <InspectionDetailModal
        inspection={viewingRecord}
        onClose={() => setViewingRecord(null)}
        theme="light"
      />

      <InspectionChecklistModal
        inspection={viewingChecklist}
        allInspections={inspections}
        onClose={() => setViewingChecklist(null)}
      />

      {showQrScanner && (
        <QRScannerModal
          onScan={handleQrScan}
          onClose={() => setShowQrScanner(false)}
        />
      )}
    </div>
  );
}