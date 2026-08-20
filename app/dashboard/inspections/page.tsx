'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { deleteStorageFiles } from '@/app/lib/storageHelpers';
import { getPeriodEndDate, equipmentExistsInPeriod } from '@/app/lib/equipmentPeriod';

import InspectionForm from '@/app/components/inspection/InspectionForm';
import InspectionDetailModal, { InspectionRecord } from '@/app/components/inspection/InspectionDetailModal';
import type { ImprovementRecord } from '@/app/components/inspection/ImprovementModal';
import { ConfirmModal, AlertModal, ConfirmState, AlertState } from '@/app/components/ui/CustomModal';
import ProtectedImage from '@/app/components/ui/ProtectedImage';

interface PicPerson {
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
  pic_1?: PicPerson | null;
  pic_2?: PicPerson | null;
}

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'Fire Alarm': return 'tone-ember';
    case 'Fire Hydrant': return 'tone-sky';
    case 'Fire Extinguisher': return 'tone-orange';
    case 'Emergency Lamp': return 'tone-amber';
    default: return 'bg-white/[0.04] text-ink-300 border-line';
  }
}

function formatMonthYear(monthYear: string): string {
  const [mm, yyyy] = monthYear.split('/');
  const monthNum = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (!mm || isNaN(monthNum) || isNaN(year)) return monthYear;
  return `${new Date(Date.UTC(year, monthNum - 1)).toLocaleString('en-US', { month: 'long' })} ${year}`;
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
        Choose a <strong className="text-ink-300">Month</strong> (and optionally <strong className="text-ink-300">Week</strong>) above to see inspection logs for that period.
      </p>
    </div>
  );
}

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

// PIC cell: profile image icon + name (falls back to initial avatar)
function PicCell({ pic, accent }: { pic?: PicPerson | null; accent: string }) {
  if (!pic?.name) {
    return <span className="text-[11px] italic text-ink-600">—</span>;
  }
  return (
    <div className="flex items-center gap-2 min-w-0" title={pic.name}>
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
      <span className="truncate text-xs text-ink-200">{pic.name}</span>
    </div>
  );
}

const PAGE_SIZE = 13;

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
    <div className="flex flex-col items-center justify-between gap-3 px-4 py-3 border-t border-line bg-ink-950/40 sm:flex-row">
      <span className="text-xs text-ink-500">
        {total === 0 ? '0 results' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
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

export default function InspectionsPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEntity, setSelectedEntity] = useState('All');
  const [selectedFacility, setSelectedFacility] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState(''); // "MM/YYYY" from inspection data
  const [selectedWeek,  setSelectedWeek]  = useState(''); // "Week N" from inspection data

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InspectionRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<InspectionRecord | null>(null);
  const [userRole, setUserRole] = useState<string>('inspector');

  const supabase = getSupabaseClient();
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [masterlist, setMasterlist] = useState<EquipmentMaster[]>([]);
  const [improvementsMap, setImprovementsMap] = useState<Map<string, ImprovementRecord>>(new Map());
  const [activeTab, setActiveTab] = useState<'logs' | 'uninspected'>('logs');
  const [uninspPage, setUninspPage] = useState(1);
  const [userPicId, setUserPicId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/');
        return;
      }

      const [profileRes, inspRes, masterRes, impRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('role, entity, facility, pic_id, pic:pic_id(id, name, entity, facility)')
          .eq('id', sessionData.session.user.id)
          .single(),
        supabase
          .from('inspections')
          .select(`
            *,
            equipment:equipment_id(location, facility, area, entity)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('equipment')
          .select(`
            id, no_id, type, entity, facility, area, location, created_at, start_date,
            pic_1:pic_1_id(id, name, phone, image_profile, image_contact),
            pic_2:pic_2_id(id, name, phone, image_profile, image_contact)
          `),
        supabase
          .from('improvements')
          .select('*'),
      ]);

      if (profileRes.data) {
        const userProfile = profileRes.data;
        if (userProfile.role) setUserRole(userProfile.role);
        setUserPicId(userProfile.pic_id ?? userProfile.pic?.id ?? null);
        // Non-admin (PIC / inspector) is auto-scoped to their assigned entity/facility.
        // Admin always sees the full masterlist across all entities/facilities.
        if (userProfile.role !== 'admin') {
          const assignedEntity = userProfile.entity || userProfile.pic?.entity;
          const assignedFacility = userProfile.facility || userProfile.pic?.facility;
          if (assignedEntity) setSelectedEntity(assignedEntity);
          if (assignedFacility) setSelectedFacility(assignedFacility);
        }
      }

      if (!inspRes.error && inspRes.data) {
        setInspections(inspRes.data as InspectionRecord[]);
      }
      if (!masterRes.error && masterRes.data) {
        setMasterlist(masterRes.data as EquipmentMaster[]);
      }
      if (impRes.data) {
        const map = new Map<string, ImprovementRecord>();
        (impRes.data as ImprovementRecord[]).forEach((imp) => map.set(imp.inspection_id, imp));
        setImprovementsMap(map);
      }
      setLoading(false);
    };

    checkAuthAndFetch();
  }, [supabase, router, reloadTrigger]);

  const [confirmModal, setConfirmModal] = useState<ConfirmState | null>(null);
  const [alertModal, setAlertModal] = useState<AlertState | null>(null);

  const handleDelete = async (id: string, noId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Inspection Log',
      message: `Are you sure you want to delete inspection log for ${noId}?`,
      variant: 'danger',
      onConfirm: async () => {
        const targetItem = inspections.find((item) => item.id === id);
        if (targetItem?.photo_url) {
          await deleteStorageFiles(supabase, 'inspection_photos', [targetItem.photo_url]);
        }

        const { error } = await supabase.from('inspections').delete().eq('id', id);
        if (!error) {
          setInspections((prev) => prev.filter((item) => item.id !== id));
        } else {
          setAlertModal({ isOpen: true, title: 'Error', message: `Failed to delete: ${error.message}`, type: 'error' });
        }
      }
    });
  };

  // Period options derived from inspection data
  const monthOptions = useMemo(() => {
    return Array.from(new Set(inspections.map((i) => i.month_year).filter(Boolean))).sort().reverse();
  }, [inspections]);

  const weekOptions = useMemo(() => {
    const base = inspections.filter((i) => i.month_year === selectedMonth);
    return Array.from(new Set(base.map((i) => i.week).filter(Boolean))).sort();
  }, [inspections, selectedMonth]);

  // Entity / Facility options derived from the masterlist (admin full-access filter).
  const uniqueEntities = useMemo(() => {
    return ['All', ...Array.from(new Set(masterlist.map((e) => e.entity).filter(Boolean) as string[])).sort()];
  }, [masterlist]);

  const uniqueFacilities = useMemo(() => {
    const base = masterlist.filter((m) => selectedEntity === 'All' || m.entity === selectedEntity);
    return ['All', ...Array.from(new Set(base.map((m) => m.facility).filter(Boolean) as string[])).sort()];
  }, [masterlist, selectedEntity]);

  // Filtered Inspections
  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      const matchesSearch =
        item.equipment_no_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.inspector_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.equipment_type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = selectedType === 'All' || item.equipment_type === selectedType;
      const matchesStatus =
        selectedStatus === 'All' ||
        (selectedStatus === 'PASS' && item.status === 'PASS') ||
        (selectedStatus === 'NEEDS_ATTENTION' && item.status !== 'PASS');

      const entity = item.equipment?.entity || '';
      const facility = item.equipment?.facility || '';
      const matchesEntity = selectedEntity === 'All' || entity === selectedEntity;
      const matchesFacility = selectedFacility === 'All' || facility === selectedFacility;

      const matchesMonth = !selectedMonth || item.month_year === selectedMonth;
      const matchesWeek  = !selectedWeek  || item.week === selectedWeek;

      return matchesSearch && matchesType && matchesStatus && matchesEntity && matchesFacility && matchesMonth && matchesWeek;
    });
  }, [inspections, searchQuery, selectedType, selectedStatus, selectedEntity, selectedFacility, selectedMonth, selectedWeek]);

  // Metrics calculation
  const totalInspections = filteredInspections.length;
  const safeCount = filteredInspections.filter((i) => i.status === 'PASS').length;
  const unsafeRows = filteredInspections.filter((i) => i.status !== 'PASS');
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
  const healthScore = totalInspections > 0
    ? Math.round(((safeCount + resolvedCount + inProgressCount) / totalInspections) * 100)
    : 100;

  // Coverage vs masterlist (same scope as reports page: type/entity/facility + selected
  // month/week). "Inspected" only counts equipment inspected during the selected week, so
  // the "Not Inspected" KPI is accurate per week. Equipment added to the masterlist AFTER the
  // selected period is excluded via equipmentExistsInPeriod, so new equipment never inflates
  // the "uninspected" count of past periods. Previous inspections/reports are never mutated.
  const periodEndDate = useMemo(
    () => getPeriodEndDate(selectedMonth, selectedWeek, weekOptions),
    [selectedMonth, selectedWeek, weekOptions]
  );
  // Equipment assigned to the logged-in user as PIC 1 or PIC 2 (admin sees all).
  const isAdmin = userRole === 'admin';
  const userAssignedEquipmentIds = useMemo(() => {
    if (isAdmin || !userPicId) return null;
    return new Set(
      masterlist
        .filter((e) => e.pic_1?.id === userPicId || e.pic_2?.id === userPicId)
        .map((e) => e.id)
    );
  }, [masterlist, userPicId, isAdmin]);

  const filteredMasterlist = useMemo(() => {
    return masterlist.filter((e) => {
      const matchType = selectedType === 'All' || e.type === selectedType;
      const matchEntity = selectedEntity === 'All' || e.entity === selectedEntity;
      const matchFacility = selectedFacility === 'All' || e.facility === selectedFacility;
      const matchPic = !userAssignedEquipmentIds || userAssignedEquipmentIds.has(e.id);
      return matchType && matchEntity && matchFacility && matchPic && equipmentExistsInPeriod(e, periodEndDate);
    });
  }, [masterlist, selectedType, selectedEntity, selectedFacility, periodEndDate, userAssignedEquipmentIds]);

  const scopeInspections = useMemo(() => {
    return inspections.filter((item) => {
      const matchType = selectedType === 'All' || item.equipment_type === selectedType;
      const entity = item.equipment?.entity ?? '';
      const facility = item.equipment?.facility ?? '';
      const matchEntity = selectedEntity === 'All' || entity === selectedEntity;
      const matchFacility = selectedFacility === 'All' || facility === selectedFacility;
      const matchMonth = !selectedMonth || item.month_year === selectedMonth;
      const matchWeek  = !selectedWeek  || item.week === selectedWeek;
      return matchType && matchEntity && matchFacility && matchMonth && matchWeek;
    });
  }, [inspections, selectedType, selectedEntity, selectedFacility, selectedMonth, selectedWeek]);

  const inspectedEquipmentIds = useMemo(
    () => new Set(scopeInspections.map((i) => i.equipment_id)),
    [scopeInspections]
  );
  const totalMasterlistCount = filteredMasterlist.length;
  const inspectedCount = useMemo(
    () => filteredMasterlist.filter((e) => inspectedEquipmentIds.has(e.id)).length,
    [filteredMasterlist, inspectedEquipmentIds]
  );
  const notInspectedCount = Math.max(0, totalMasterlistCount - inspectedCount);

  // ★ Uninspected equipment list from the masterlist (with related PIC auto-integrated)
  const uninspectedRows = useMemo(() => {
    return filteredMasterlist
      .filter((e) => !inspectedEquipmentIds.has(e.id))
      .sort((a, b) => a.no_id.localeCompare(b.no_id));
  }, [filteredMasterlist, inspectedEquipmentIds]);

  const uninspSlice = useMemo(
    () => uninspectedRows.slice((uninspPage - 1) * PAGE_SIZE, uninspPage * PAGE_SIZE),
    [uninspectedRows, uninspPage]
  );

  // Data is only shown once the user picks a period filter (month/week).
  const hasPeriodFilter = selectedMonth !== '' || selectedWeek !== '';

  // Reset week when month changes
  const [prevMonth, setPrevMonth] = useState(selectedMonth);
  if (prevMonth !== selectedMonth) {
    setPrevMonth(selectedMonth);
    setSelectedWeek('');
  }

  const setThisMonth = () => {
    const now = new Date();
    setSelectedMonth(`${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`);
    setSelectedWeek('');
  };
  const clearPeriod = () => {
    setSelectedMonth('');
    setSelectedWeek('');
  };

  // Reset uninspected pagination when filters change
  const filterSignature = [searchQuery, selectedType, selectedEntity, selectedFacility, selectedMonth, selectedWeek].join('|');
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  if (prevFilterSignature !== filterSignature) {
    setPrevFilterSignature(filterSignature);
    setUninspPage(1);
  }

  return (
    <>
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                  Personnel Portal
                </span>
<span className="text-xs font-semibold px-2 py-0.5 rounded-full border tone-ember">
                          Full Access
                        </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-ink-100 mt-1">
                Equipment Inspection Logs
              </h1>
              <p className="text-xs text-ink-400 mt-0.5">
                Perform inspections on masterlist data, evaluate checklist questions, and upload verification photos.
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary text-xs px-5 py-2.5 shadow-lg shadow-ember-950/40"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Perform New Inspection
            </button>
          </div>

          {/* Filters & Search Bar */}
          <div className="panel p-5 space-y-4">
            {/* Row 1: search, entity, facility, type, status */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[140px]">
                <label className="field-label text-[10px]">Search</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ID, inspector, type…"
                    className="input pl-9 text-xs"
                  />
                  <svg className="absolute left-3 top-2.5 w-4 h-4 text-ink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
              </div>

              {isAdmin && (
                <>
                  <div className="flex-1 min-w-[130px]">
                    <label className="field-label text-[10px]">Entity</label>
                    <select
                      value={selectedEntity}
                      onChange={(e) => { const v = e.target.value; setSelectedEntity(v); if (v !== selectedEntity) setSelectedFacility('All'); }}
                      className="input text-xs"
                    >
                      {uniqueEntities.map((e) => (
                        <option key={e} value={e}>{e === 'All' ? 'All Entities' : e}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[130px]">
                    <label className="field-label text-[10px]">Facility</label>
                    <select
                      value={selectedFacility}
                      onChange={(e) => setSelectedFacility(e.target.value)}
                      className="input text-xs"
                    >
                      {uniqueFacilities.map((f) => (
                        <option key={f} value={f}>{f === 'All' ? 'All Facilities' : f}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex-1 min-w-[130px]">
                <label className="field-label text-[10px]">Equipment Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="input text-xs"
                >
                  <option value="All">All Types</option>
                  <option value="Fire Extinguisher">Fire Extinguisher</option>
                  <option value="Fire Alarm">Fire Alarm</option>
                  <option value="Fire Hydrant">Fire Hydrant</option>
                  <option value="Emergency Lamp">Emergency Lamp</option>
                </select>
              </div>

              <div className="flex-1 min-w-[130px]">
                <label className="field-label text-[10px]">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="input text-xs"
                >
                  <option value="All">All Statuses</option>
                  <option value="PASS">Pass Only</option>
                  <option value="NEEDS_ATTENTION">Needs Attention</option>
                </select>
              </div>
            </div>

            {/* Row 2: period (month then week) */}
            <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
              <div>
                <label className="field-label text-[10px]">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input text-xs w-40"
                >
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
                  <button onClick={clearPeriod} className="btn btn-ghost text-xs px-3 py-2 text-rose-400 hover:text-rose-600">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Metrics Cards */}
          {hasPeriodFilter ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
              <KpiCard label="Total Inspections" value={totalInspections} sub="In selected filters" color="text-ink-100" />
              <KpiCard
                label="Needs Attention"
                value={openCount}
                sub="OPEN · needs action"
                color="text-rose-400"
                borderColor="border-rose-900/30"
              />
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
              <KpiCard
                label="Safe"
                value={safeCount}
                sub="PASS results"
                color="text-emerald-400"
                borderColor="border-emerald-900/30"
              />
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
              <FilterRequired scope="inspection metrics" />
            </div>
          )}

          {/* Table */}
          <div className="table-wrap">
            {!hasPeriodFilter ? (
              <FilterRequired scope="inspection logs" />
            ) : (
            <>
              {/* Tabs */}
              <div className="flex overflow-x-auto border-b border-line bg-ink-950/40">
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 text-xs sm:text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
                    activeTab === 'logs' ? 'border-ember-500 text-ember-300' : 'border-transparent text-ink-400 hover:text-ink-100'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Inspection Logs
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${activeTab === 'logs' ? 'bg-ember-500/15 text-ember-300 border-ember-500/30' : 'bg-ink-800 text-ink-300 border-transparent'}`}>
                    {totalInspections}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('uninspected')}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-3.5 text-xs sm:text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
                    activeTab === 'uninspected' ? 'border-amber-500 text-amber-300' : 'border-transparent text-ink-400 hover:text-ink-100'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  Uninspected Equipment
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${activeTab === 'uninspected' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-ink-800 text-ink-300 border-transparent'}`}>
                    {notInspectedCount}
                  </span>
                </button>
              </div>

            {activeTab === 'logs' ? (
            <div className="overflow-x-auto">
              <table className="mobile-cards w-full text-left">
                <thead>
                  <tr className="border-b border-line bg-ink-950/40">
                    <th className="th">Equipment ID</th>
                    <th className="th">Type</th>
                    <th className="th">Entity / Facility</th>
                    <th className="th">Date / Period</th>
                    <th className="th">Inspector</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-ink-500">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500 mb-2" />
                        <p className="text-xs">Loading inspection logs...</p>
                      </td>
                    </tr>
                  ) : filteredInspections.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-ink-500">
                        No inspection records found.
                      </td>
                    </tr>
                  ) : (
                    filteredInspections.map((item) => {
                      const entity = item.equipment?.entity || '';
                      const facility = item.equipment?.facility || '';
                      const isPass = item.status === 'PASS';
                      return (
                        <tr key={item.id} className="transition-colors hover:bg-white/[0.03]">
                          <td data-label="Equipment ID" className="td font-bold text-ink-100">{item.equipment_no_id}</td>
                          <td data-label="Type" className="td">
                            <span
                              className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(
                                item.equipment_type
                              )}`}
                            >
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
                            <div className="text-ink-500 text-[11px]">
                              {item.week} ({item.month_year})
                            </div>
                          </td>
                          <td data-label="Inspector" className="td text-xs text-ink-200">{item.inspector_name}</td>
                          <td data-label="Status" className="td">
                            {(() => {
                              const improvement = improvementsMap.get(item.id);
                              const shownAsCapa = !isPass && !!improvement;
                              if (shownAsCapa) {
                                const capaResolved = improvement.status === 'RESOLVED';
                                const capaInProgress = improvement.status === 'IN_PROGRESS';
                                return (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                    capaResolved ? 'tone-emerald' : capaInProgress ? 'tone-amber' : 'tone-rose'
                                  }`}>
                                    {capaResolved ? (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    ) : capaInProgress ? (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                      </svg>
                                    ) : (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                      </svg>
                                    )}
                                    {capaResolved ? 'RESOLVED' : capaInProgress ? 'IN PROGRESS' : 'OPEN'}
                                  </span>
                                );
                              }
                              return (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                    isPass ? 'tone-emerald' : 'tone-rose'
                                  }`}
                                >
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
                          <td data-label="Actions" className="td text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
                              {userRole === 'admin' && (
                                <button
                                  onClick={() => setEditingRecord(item)}
                                  className="btn btn-ghost text-xs px-2.5 py-1 text-amber-400 hover:bg-amber-950/30 font-medium"
                                  title="Edit this inspection log (Admin Only)"
                                >
                                  ✏️ Edit
                                </button>
                              )}
                              <button
                                onClick={() => setViewingRecord(item)}
                                className="btn btn-ghost text-xs px-3 py-1"
                              >
                                View Detail
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.equipment_no_id)}
                                className="btn btn-danger-soft text-xs px-2.5 py-1"
                                title="Delete inspection"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            ) : (
            <>
            {!isAdmin && userPicId && (
              <div className="px-4 py-2.5 border-b border-amber-200 bg-white text-[11px] text-amber-800/90 flex items-center gap-2">
                <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Showing only equipment assigned to you as <strong className="text-amber-700">PIC 1 / PIC 2</strong>. These are the items left uninspected for you in this period.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="mobile-cards w-full table-fixed text-left">
                <thead>
                  <tr className="border-b border-line bg-ink-950/40">
                    <th className="th w-[15%]">Equipment ID</th>
                    <th className="th w-[12%]">Type</th>
                    <th className="th w-[17%]">Entity / Facility</th>
                    <th className="th w-[16%]">Area / Location</th>
                    <th className="th w-[13%]">PIC 1</th>
                    <th className="th w-[13%]">PIC 2</th>
                    <th className="th w-[14%] text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-ink-500">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500 mb-2" />
                        <p className="text-xs">Loading equipment...</p>
                      </td>
                    </tr>
                  ) : uninspSlice.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-ink-500">
                        <p className="text-sm">
                          {notInspectedCount === 0
                            ? 'All equipment in the masterlist has been inspected. No pending items.'
                            : 'No uninspected equipment match your filters.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    uninspSlice.map((equip) => (
                      <tr key={equip.id} className="transition-colors hover:bg-white/[0.03]">
                        <td data-label="Equipment ID" className="td font-bold text-amber-400">
                          <span className="block truncate">{equip.no_id}</span>
                        </td>
                        <td data-label="Type" className="td">
                          <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(equip.type)}`}>
                            {equip.type}
                          </span>
                        </td>
                        <td data-label="Entity / Facility" className="td text-xs">
                          {equip.entity && <div className="text-ink-200 font-medium truncate">{equip.entity}</div>}
                          {equip.facility && <div className="text-ink-500 text-[11px] truncate">{equip.facility}</div>}
                          {!equip.entity && !equip.facility && <span className="text-ink-600 italic">—</span>}
                        </td>
                        <td data-label="Area / Location" className="td text-xs text-ink-300">
                          <span className="block truncate">
                            {[equip.area, equip.location].filter(Boolean).join(' · ') || (equip.area || '—')}
                          </span>
                        </td>
                        <td data-label="PIC 1" className="td">
                          <PicCell pic={equip.pic_1} accent="border-amber-400/40 text-amber-400 bg-amber-950/40" />
                        </td>
                        <td data-label="PIC 2" className="td">
                          <PicCell pic={equip.pic_2} accent="border-amber-400/40 text-amber-400 bg-amber-950/40" />
                        </td>
                        <td data-label="Status" className="td text-right">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border tone-amber whitespace-nowrap">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            Not Inspected
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
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
            </>
            )}
          </div>
        </div>
      </div>

      {/* Modal for Creating or Editing Inspection */}
      {(showCreateModal || editingRecord) && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 md:p-6 bg-ink-950/80 backdrop-blur-md flex justify-center items-start animate-fade">
          <div className="relative w-full max-w-4xl bg-ink-900 border border-line rounded-3xl shadow-2xl p-6 my-auto sm:my-8">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
              <h2 className="text-xl font-bold text-ink-100 flex items-center gap-2">
                {editingRecord ? '✏️ Edit Inspection Log (Admin Mode)' : 'Perform Live Equipment Inspection'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingRecord(null);
                }}
                className="text-ink-400 hover:text-ink-100 text-sm font-medium"
              >
                ✕ Close
              </button>
            </div>

            <InspectionForm
              editRecord={editingRecord}
              onSuccess={() => {
                setShowCreateModal(false);
                setEditingRecord(null);
                setLoading(true);
                setReloadTrigger((t) => t + 1);
              }}
              onCancel={() => {
                setShowCreateModal(false);
                setEditingRecord(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Modal for Viewing Inspection Detail */}
      <InspectionDetailModal
        inspection={viewingRecord}
        onClose={() => setViewingRecord(null)}
        onEdit={(item) => setEditingRecord(item)}
      />

      <ConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />
      <AlertModal state={alertModal} onClose={() => setAlertModal(null)} />
    </>
  );
}
