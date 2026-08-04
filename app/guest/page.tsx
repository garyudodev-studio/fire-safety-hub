'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo } from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import Link from 'next/link';
import InspectionDetailModal, { InspectionRecord } from '@/app/components/inspection/InspectionDetailModal';
import ImageModal from '@/app/components/ui/ImageModal';
import ProtectedImage from '@/app/components/ui/ProtectedImage';

const Icon = ({ children, size = 16 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

type EquipmentRow = {
  id: string;
  no_id: string;
  type: string;
  location: string;
  facility: string;
  area: string;
  entity: string;
  updated_at: string;
  pic_1?: { name?: string } | null;
};

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'Fire Alarm': return 'bg-ember-950/60 text-ember-300 border-ember-900/60';
    case 'Fire Hydrant': return 'bg-sky-950/60 text-sky-300 border-sky-900/60';
    case 'Fire Extinguisher': return 'bg-orange-950/60 text-orange-300 border-orange-900/60';
    case 'Emergency Lamp': return 'bg-amber-950/60 text-amber-300 border-amber-900/60';
    case 'Emergency Exit Lamp': return 'bg-emerald-950/60 text-emerald-300 border-emerald-900/60';
    default: return 'bg-white/[0.04] text-ink-300 border-line';
  }
}

const TYPE_COLORS: Record<string, string> = {
  'Fire Extinguisher': '#f97316',
  'Fire Alarm': '#ef4444',
  'Fire Hydrant': '#38bdf8',
  'Emergency Lamp': '#fbbf24',
  'Emergency Exit Lamp': '#34d399',
};

const EQUIPMENT_TYPES = [
  'Fire Extinguisher',
  'Fire Alarm',
  'Fire Hydrant',
  'Emergency Lamp',
  'Emergency Exit Lamp',
];

function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function PassRateRing({ rate }: { rate: number }) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  const color = rate >= 80 ? '#34d399' : rate >= 50 ? '#fbbf24' : '#f87171';
  return (
    <div className="panel p-4 flex flex-col items-center justify-center gap-1 text-center">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Pass Rate</span>
      <div className="relative flex items-center justify-center my-1">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={r}
            fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)' }}
          />
        </svg>
        <span className="absolute text-lg font-bold" style={{ color }}>{rate}%</span>
      </div>
      <span className="text-[11px] text-ink-500">Health Score</span>
    </div>
  );
}

export default function GuestDashboard() {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'inspections' | 'masterlist'>('monitoring');
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRecord, setViewingRecord] = useState<InspectionRecord | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Filters for Guest mode
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('All');
  const [selectedFacility, setSelectedFacility] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const supabase = getSupabaseClient();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch Equipment Masterlist
      const { data: eqData } = await supabase
        .from('equipment')
        .select(`
          *,
          pic_1:pic_1_id(name, phone),
          pic_2:pic_2_id(name, phone)
        `)
        .order('no_id', { ascending: true });

      if (eqData) setEquipment(eqData as EquipmentRow[]);

      // Fetch Inspection Logs
      const { data: inspData } = await supabase
        .from('inspections')
        .select(`
          *,
          equipment:equipment_id(location, facility, area, entity)
        `)
        .order('created_at', { ascending: false });

      if (inspData) setInspections(inspData as InspectionRecord[]);

      setLoading(false);
    };

    fetchData();
  }, []);

  // Cascading entity & facility options
  const uniqueEntities = useMemo(() => {
    const set = new Set<string>();
    equipment.forEach(e => { if (e.entity) set.add(e.entity); });
    inspections.forEach(i => {
      const ent = (i.equipment as any)?.entity;
      if (ent) set.add(ent);
    });
    return Array.from(set).sort();
  }, [equipment, inspections]);

  const uniqueFacilities = useMemo(() => {
    const set = new Set<string>();
    equipment.forEach(e => {
      if (e.facility && (selectedEntity === 'All' || e.entity === selectedEntity)) {
        set.add(e.facility);
      }
    });
    inspections.forEach(i => {
      const ent = (i.equipment as any)?.entity;
      const fac = (i.equipment as any)?.facility;
      if (fac && (selectedEntity === 'All' || ent === selectedEntity)) {
        set.add(fac);
      }
    });
    return Array.from(set).sort();
  }, [equipment, inspections, selectedEntity]);

  // Filtered Inspections for Guest
  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      const eqEntity = (item.equipment as any)?.entity || '';
      const eqFacility = (item.equipment as any)?.facility || '';

      const matchEntity = selectedEntity === 'All' || eqEntity === selectedEntity;
      const matchFacility = selectedFacility === 'All' || eqFacility === selectedFacility;

      const matchSearch =
        item.equipment_no_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.inspector_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.equipment_type.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType = selectedType === 'All' || item.equipment_type === selectedType;
      const matchStatus =
        selectedStatus === 'All' ||
        (selectedStatus === 'PASS' && item.status === 'PASS') ||
        (selectedStatus === 'NEEDS_ATTENTION' && item.status !== 'PASS');

      const itemDate = item.inspection_date;
      const matchFrom = !dateFrom || itemDate >= dateFrom;
      const matchTo = !dateTo || itemDate <= dateTo;

      return matchEntity && matchFacility && matchSearch && matchType && matchStatus && matchFrom && matchTo;
    });
  }, [inspections, selectedEntity, selectedFacility, searchQuery, selectedType, selectedStatus, dateFrom, dateTo]);

  // Filtered Equipment for Guest
  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      const matchEntity = selectedEntity === 'All' || item.entity === selectedEntity;
      const matchFacility = selectedFacility === 'All' || item.facility === selectedFacility;

      const matchSearch =
        item.no_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType = selectedType === 'All' || item.type === selectedType;

      return matchEntity && matchFacility && matchSearch && matchType;
    });
  }, [equipment, selectedEntity, selectedFacility, searchQuery, selectedType]);

  const setThisMonth = () => {
    setDateFrom(firstOfMonthStr());
    setDateTo(todayStr());
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedEntity('All');
    setSelectedFacility('All');
    setSelectedType('All');
    setSelectedStatus('All');
    setDateFrom('');
    setDateTo('');
  };

  const totalInspections = filteredInspections.length;
  const passCount = filteredInspections.filter((i) => i.status === 'PASS').length;
  const needsAttentionCount = filteredInspections.filter((i) => i.status !== 'PASS').length;
  const passRate = totalInspections > 0 ? Math.round((passCount / totalInspections) * 100) : 100;

  const uniqueInspectedCount = useMemo(() => new Set(filteredInspections.map(i => i.equipment_no_id)).size, [filteredInspections]);
  const totalMasterlistAll = filteredEquipment.length;
  const overallPending = Math.max(0, totalMasterlistAll - uniqueInspectedCount);
  const overallCoverage = totalMasterlistAll > 0 ? Math.round((uniqueInspectedCount / totalMasterlistAll) * 100) : 0;

  const datePeriodText = dateFrom || dateTo ? `${dateFrom || 'Start'} to ${dateTo || 'Today'}` : 'All Recorded Dates';

  return (
    <div className="min-h-screen bg-ink-950 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="panel p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember-600/15 text-ember-400 border border-ember-900/50">
              <Icon size={22}>
                <path d="M12 3 4 6v6c0 4.4 3.2 7.7 8 9 4.8-1.3 8-4.6 8-9V6l-8-3Z" />
              </Icon>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">Public Portal</p>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-950/60 text-sky-300 border border-sky-900/60">
                  Read Only Viewer
                </span>
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-ink-100 md:text-2xl">
                Fire Safety Monitoring & Inspection Reports
              </h1>
              <p className="mt-0.5 text-sm text-ink-400">Interactive viewer for equipment masterlist and inspection logs by date period.</p>
            </div>
          </div>
          <Link href="/" className="btn btn-ghost text-xs">
            <ArrowLeft /> Back to Login
          </Link>
        </header>

        {/* Navigation & View Toggle */}
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('monitoring')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'monitoring'
                  ? 'bg-ink-800 text-ember-400 border border-line shadow-sm'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              📊 Data Monitoring Dashboard
            </button>
            <button
              onClick={() => setActiveTab('inspections')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'inspections'
                  ? 'bg-ink-800 text-ember-400 border border-line shadow-sm'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              📋 Inspection Reports ({filteredInspections.length})
            </button>
            <button
              onClick={() => setActiveTab('masterlist')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'masterlist'
                  ? 'bg-ink-800 text-ember-400 border border-line shadow-sm'
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              🏢 Equipment Masterlist ({filteredEquipment.length})
            </button>
          </div>
        </div>

        {/* Guest Filter Bar */}
        <div className="panel p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[150px]">
              <label className="field-label text-[10px]">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ID, inspector, location…"
                className="input text-xs"
              />
            </div>

            {/* Entity Filter */}
            <div className="flex-1 min-w-[130px]">
              <label className="field-label text-[10px]">Entity</label>
              <select
                value={selectedEntity}
                onChange={(e) => {
                  setSelectedEntity(e.target.value);
                  setSelectedFacility('All');
                }}
                className="input text-xs"
              >
                <option value="All">All Entities</option>
                {uniqueEntities.map(ent => (
                  <option key={ent} value={ent}>{ent}</option>
                ))}
              </select>
            </div>

            {/* Facility Filter */}
            <div className="flex-1 min-w-[130px]">
              <label className="field-label text-[10px]">Facility</label>
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="input text-xs"
              >
                <option value="All">All Facilities</option>
                {uniqueFacilities.map(fac => (
                  <option key={fac} value={fac}>{fac}</option>
                ))}
              </select>
            </div>

            {/* Type */}
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

            {/* Status */}
            <div className="flex-1 min-w-[130px]">
              <label className="field-label text-[10px]">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input text-xs"
              >
                <option value="All">All Statuses</option>
                <option value="PASS">PASS Only</option>
                <option value="NEEDS_ATTENTION">NEEDS ATTENTION Only</option>
              </select>
            </div>

            {/* Date Period Pickers */}
            <div>
              <label className="field-label text-[10px]">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input text-xs w-36"
              />
            </div>

            <div>
              <label className="field-label text-[10px]">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input text-xs w-36"
              />
            </div>

            <div className="flex gap-2 pb-0.5">
              <button onClick={setThisMonth} className="btn btn-ghost text-xs px-3 py-2 whitespace-nowrap">
                This Month
              </button>
              {(searchQuery || selectedEntity !== 'All' || selectedFacility !== 'All' || selectedType !== 'All' || selectedStatus !== 'All' || dateFrom || dateTo) && (
                <button onClick={clearFilters} className="btn btn-ghost text-xs px-3 py-2 text-rose-400 hover:text-rose-300">
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-ink-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500" />
            <p className="text-sm">Loading data…</p>
          </div>
        ) : activeTab === 'monitoring' ? (
          /* Interactive Data Monitoring Dashboard View */
          <div className="space-y-6 animate-fade">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="panel p-4 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Total Inspections</span>
                <span className="text-3xl font-bold text-ink-100 mt-1">{totalInspections}</span>
                <span className="text-xs text-ink-500 mt-0.5">In selected period</span>
              </div>

              <div className="panel p-4 flex flex-col items-center justify-center text-center border-emerald-900/30">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Safe (PASS)</span>
                <span className="text-3xl font-bold text-emerald-400 mt-1">{passCount}</span>
                <span className="text-xs text-ink-500 mt-0.5">No defects found</span>
              </div>

              <div className="panel p-4 flex flex-col items-center justify-center text-center border-rose-900/30">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Needs Attention</span>
                <span className="text-3xl font-bold text-rose-400 mt-1">{needsAttentionCount}</span>
                <span className="text-xs text-ink-500 mt-0.5">Defects flagged</span>
              </div>

              <div className="panel p-4 flex flex-col items-center justify-center text-center border-amber-900/30">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Uninspected Equipment</span>
                <span className={`text-3xl font-bold mt-1 ${overallPending > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{overallPending}</span>
                <span className="text-xs text-ink-500 mt-0.5">of {totalMasterlistAll} masterlist total</span>
              </div>

              <PassRateRing rate={passRate} />
            </div>

            {/* Coverage Breakdown */}
            <div className="panel p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-line pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-200 flex items-center gap-2">
                    Masterlist Equipment Coverage
                    <span className="text-[10px] font-normal px-2.5 py-0.5 rounded-full bg-ember-950/80 text-ember-300 border border-ember-900/60 font-mono">
                      📅 Period: {datePeriodText}
                    </span>
                  </h3>
                  <p className="text-xs text-ink-400 mt-1">
                    Masterlist total: <strong className="text-ink-100">{totalMasterlistAll}</strong> equipment · Inspected: <strong className="text-sky-300">{uniqueInspectedCount}/{totalMasterlistAll} ({overallCoverage}%)</strong>
                  </p>
                </div>

                <div>
                  {overallPending === 0 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-900/60">
                      ✓ 100% Fully Inspected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-900/60">
                      ⚠️ {overallPending} Equipment Pending Inspection
                    </span>
                  )}
                </div>
              </div>

              {/* Type breakdown progress bars */}
              <div className="space-y-4 pt-1">
                {EQUIPMENT_TYPES.map((t) => {
                  const totalEquip = filteredEquipment.filter(e => e.type === t).length;
                  const inspected = filteredInspections.filter(i => i.equipment_type === t);
                  const inspectedCount = new Set(inspected.map(i => i.equipment_no_id)).size;
                  const passCountType = inspected.filter(i => i.status === 'PASS').length;
                  const notInspected = Math.max(0, totalEquip - inspectedCount);
                  const passRateType = inspected.length > 0 ? Math.round((passCountType / inspected.length) * 100) : null;
                  const coverageType = totalEquip > 0 ? Math.round((inspectedCount / totalEquip) * 100) : null;
                  const col = TYPE_COLORS[t] || '#8b91a0';

                  if (totalEquip === 0 && inspectedCount === 0) return null;

                  return (
                    <div key={t} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-ink-200 font-semibold truncate">{t}</span>
                        <div className="flex items-center gap-2 shrink-0 text-ink-400">
                          <span className="bg-ink-850 px-2 py-0.5 rounded border border-line">
                            Inspected: <strong className="text-ink-100">{inspectedCount}</strong> / <span className="text-ink-300">{totalEquip} Masterlist Total</span>
                          </span>
                          {passRateType !== null && (
                            <span style={{ color: col }} className="font-bold">{passRateType}% PASS</span>
                          )}
                          {notInspected > 0 ? (
                            <span className="text-amber-400 font-bold bg-amber-950/50 border border-amber-900/50 px-2 py-0.5 rounded text-[11px]">
                              {notInspected} Pending
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-bold bg-emerald-950/50 border border-emerald-900/50 px-2 py-0.5 rounded text-[11px]">
                              ✓ Complete
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="relative h-3 rounded-full bg-ink-800 overflow-hidden w-full">
                        <div
                          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${totalEquip > 0 ? (inspectedCount / totalEquip) * 100 : 0}%`,
                            backgroundColor: col
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-ink-500">
                        <span>{coverageType}% of total masterlist equipment inspected in this period</span>
                        {notInspected > 0 && <span className="text-amber-400">{notInspected} equipment remaining</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : activeTab === 'masterlist' ? (
          /* Equipment Masterlist Table */
          <div className="table-wrap">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line bg-ink-950/40">
                    <th className="th">ID</th>
                    <th className="th">Type</th>
                    <th className="th">Entity / Facility</th>
                    <th className="th">Location / Area</th>
                    <th className="th">PIC</th>
                    <th className="th">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredEquipment.map((item, idx) => (
                    <tr key={item.id ? `${item.id}-${idx}` : `${item.no_id}-${idx}`} className="transition-colors hover:bg-white/[0.03]">
                      <td className="td"><span className="id-pill">{item.no_id}</span></td>
                      <td className="td">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(item.type)}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="td text-xs text-ink-300">
                        <span className="font-semibold text-ink-100">{item.entity || '-'}</span>
                        <div className="text-[11px] text-ink-500">{item.facility || '-'}</div>
                      </td>
                      <td className="td text-sm text-ink-300">
                        {item.location} <span className="text-ink-600">—</span> {item.area}
                      </td>
                      <td className="td text-sm text-ink-300">
                        {item.pic_1?.name || <span className="text-ink-600">Unassigned</span>}
                      </td>
                      <td className="td text-sm text-ink-500">
                        {new Date(item.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {filteredEquipment.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-ink-500">
                        No equipment records match your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Inspection Logs Table (Read Only with Protected Image Preview) */
          <div className="table-wrap">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line bg-ink-950/40">
                    <th className="th">Equipment ID</th>
                    <th className="th">Type</th>
                    <th className="th">Entity / Facility</th>
                    <th className="th">Date</th>
                    <th className="th">Inspector</th>
                    <th className="th">Status</th>
                    <th className="th">Equipment Photo</th>
                    <th className="th text-right">View Checklist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredInspections.map((item, idx) => (
                    <tr key={item.id ? `${item.id}-${idx}` : `${item.equipment_no_id}-${idx}`} className="transition-colors hover:bg-white/[0.03]">
                      <td className="td font-bold text-ink-100">{item.equipment_no_id}</td>
                      <td className="td">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(item.equipment_type)}`}>
                          {item.equipment_type}
                        </span>
                      </td>
                      <td className="td text-xs text-ink-300">
                        <span className="font-semibold text-ink-100">{(item.equipment as any)?.entity || '-'}</span>
                        <div className="text-[11px] text-ink-500">{(item.equipment as any)?.facility || '-'}</div>
                      </td>
                      <td className="td text-xs text-ink-300">
                        <div>{item.inspection_date}</div>
                        <div className="text-ink-500 text-[11px]">{item.week} ({item.month_year})</div>
                      </td>
                      <td className="td text-xs text-ink-200">{item.inspector_name}</td>
                      <td className="td">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                            item.status === 'PASS'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-900/60'
                              : 'bg-rose-950/60 text-rose-300 border-rose-900/60'
                          }`}
                        >
                          {item.status === 'PASS' ? '✓ PASS' : '⚠️ NEEDS ATTENTION'}
                        </span>
                      </td>
                      <td className="td">
                        <div className="w-12 h-9 rounded-lg overflow-hidden border border-line bg-black cursor-pointer hover:ring-2 hover:ring-ember-500 transition-all">
                          <ProtectedImage
                            src={item.photo_url.split(',')[0].trim()}
                            alt="Equipment Photo"
                            onPreview={() => setPreviewImage({ url: item.photo_url.split(',')[0].trim(), title: `Inspection Photo - ${item.equipment_no_id}` })}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="td text-right">
                        <button
                          onClick={() => setViewingRecord(item)}
                          className="btn btn-ghost text-xs px-3 py-1 text-ink-200 hover:text-ink-100 border border-line"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredInspections.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-ink-500">
                        No inspection records found for the selected date period and filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Read-Only Inspection Detail Modal */}
      <InspectionDetailModal
        inspection={viewingRecord}
        onClose={() => setViewingRecord(null)}
      />

      {/* Image Preview Modal */}
      <ImageModal
        imageUrl={previewImage?.url || null}
        title={previewImage?.title || 'Inspection Photo Preview'}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
