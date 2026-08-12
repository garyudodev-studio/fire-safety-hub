'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import ImprovementModal, { ImprovementRecord } from '@/app/components/inspection/ImprovementModal';
import { InspectionRecord } from '@/app/components/inspection/InspectionDetailModal';
import InspectionDetailModal from '@/app/components/inspection/InspectionDetailModal';
import ProtectedImage from '@/app/components/ui/ProtectedImage';
import ImageModal from '@/app/components/ui/ImageModal';
import { AlertModal, AlertState } from '@/app/components/ui/CustomModal';

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'Fire Alarm': return 'tone-ember';
    case 'Fire Hydrant': return 'tone-sky';
    case 'Fire Extinguisher': return 'tone-orange';
    case 'Emergency Lamp': return 'tone-amber';
    default: return 'bg-white/[0.04] text-ink-300 border-line';
  }
}

function getStatusBadge(status?: string) {
  switch (status) {
    case 'RESOLVED':
      return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded tone-emerald">RESOLVED (Fixed)</span>;
    case 'IN_PROGRESS':
      return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded tone-amber">IN_PROGRESS (Repairing)</span>;
    default:
      return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded tone-rose">OPEN (Needs Action)</span>;
  }
}

interface CombinedUnsafeRecord {
  inspection: InspectionRecord;
  improvement: ImprovementRecord | null;
}

export default function ImprovementsPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [records, setRecords] = useState<CombinedUnsafeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedFacility, setSelectedFacility] = useState('ALL');

  // Modal states
  const [activeImprovementInspection, setActiveImprovementInspection] = useState<InspectionRecord | null>(null);
  const [activeExistingImprovement, setActiveExistingImprovement] = useState<ImprovementRecord | null>(null);
  const [viewingInspection, setViewingInspection] = useState<InspectionRecord | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
  const [alertModal, setAlertModal] = useState<AlertState | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/');
        return;
      }

      // Fetch inspections marked NEEDS_ATTENTION OR inspections with an existing improvement
      const { data: inspData, error: inspErr } = await supabase
        .from('inspections')
        .select(`
          *,
          equipment:equipment_id(location, facility, area, entity)
        `)
        .order('created_at', { ascending: false });

      if (inspErr) {
        setAlertModal({ isOpen: true, title: 'Error', message: inspErr.message, type: 'error' });
        setLoading(false);
        return;
      }

      // Fetch all improvements
      const { data: impData } = await supabase
        .from('improvements')
        .select('*');

      const impMap = new Map<string, ImprovementRecord>();
      if (impData) {
        (impData as ImprovementRecord[]).forEach((imp) => {
          impMap.set(imp.inspection_id, imp);
        });
      }

      const combined: CombinedUnsafeRecord[] = [];
      (inspData as InspectionRecord[]).forEach((insp) => {
        const imp = impMap.get(insp.id) || null;
        // Include if inspection needs attention OR if there is an improvement record
        if (insp.status === 'NEEDS_ATTENTION' || imp !== null) {
          combined.push({
            inspection: insp,
            improvement: imp,
          });
        }
      });

      setRecords(combined);
      setLoading(false);
    };

    fetchData();
  }, [supabase, router, reloadTrigger]);

  // Unique options for dropdowns
  const uniqueFacilities = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      const fac = r.inspection.equipment?.facility;
      if (fac) set.add(fac);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [records]);

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.inspection.equipment_type) set.add(r.inspection.equipment_type);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const impStatus = r.improvement?.status || 'OPEN';
      const matchesStatus = selectedStatus === 'ALL' || impStatus === selectedStatus;
      const matchesType = selectedType === 'ALL' || r.inspection.equipment_type === selectedType;
      const matchesFacility = selectedFacility === 'ALL' || r.inspection.equipment?.facility === selectedFacility;

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        r.inspection.equipment_no_id.toLowerCase().includes(q) ||
        r.inspection.equipment_type.toLowerCase().includes(q) ||
        (r.inspection.inspector_name && r.inspection.inspector_name.toLowerCase().includes(q)) ||
        (r.improvement?.pic_name && r.improvement.pic_name.toLowerCase().includes(q)) ||
        (r.improvement?.action_taken && r.improvement.action_taken.toLowerCase().includes(q)) ||
        (r.inspection.remarks && r.inspection.remarks.toLowerCase().includes(q));

      return matchesStatus && matchesType && matchesFacility && matchesSearch;
    });
  }, [records, selectedStatus, selectedType, selectedFacility, searchQuery]);

  // Calculated KPIs
  const totalUnsafe = records.length;
  const openCount = records.filter((r) => (!r.improvement || r.improvement.status === 'OPEN')).length;
  const inProgressCount = records.filter((r) => r.improvement?.status === 'IN_PROGRESS').length;
  const resolvedCount = records.filter((r) => r.improvement?.status === 'RESOLVED').length;
  const resolutionRate = totalUnsafe > 0 ? Math.round((resolvedCount / totalUnsafe) * 100) : 0;

  const handleOpenModal = (inspection: InspectionRecord, existing: ImprovementRecord | null) => {
    setActiveImprovementInspection(inspection);
    setActiveExistingImprovement(existing);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-100 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl tone-amber border border-amber-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </span>
            Unsafe Condition Improvements (CAPA)
          </h1>
          <p className="text-xs text-ink-400 mt-1">
            Track corrective action plans, target resolution dates, and proof of fix for unsafe equipment inspections.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <div className="panel p-4 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Total Unsafe Cases</span>
          <span className="text-3xl font-bold mt-1 text-ink-100">{totalUnsafe}</span>
        </div>
        <div className="panel p-4 flex flex-col items-center justify-center text-center border-rose-900/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Open (Action Needed)</span>
          <span className="text-3xl font-bold mt-1 text-rose-400">{openCount}</span>
        </div>
        <div className="panel p-4 flex flex-col items-center justify-center text-center border-amber-900/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">In Progress</span>
          <span className="text-3xl font-bold mt-1 text-amber-400">{inProgressCount}</span>
        </div>
        <div className="panel p-4 flex flex-col items-center justify-center text-center border-emerald-900/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Resolved (Fixed)</span>
          <span className="text-3xl font-bold mt-1 text-emerald-400">{resolvedCount}</span>
        </div>
        <div className="panel p-4 flex flex-col items-center justify-center text-center border-sky-900/40">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">Resolution Rate</span>
          <span className="text-3xl font-bold mt-1 text-sky-400">{resolutionRate}%</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="panel p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
          {/* Status filter */}
          <div className="flex flex-wrap items-center gap-1.5 bg-ink-950 p-1.5 rounded-lg border border-line">
            <span className="text-ink-500 font-semibold px-2">Status:</span>
            {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded font-semibold transition-colors whitespace-nowrap ${
                  selectedStatus === st
                    ? 'bg-ink-800 text-ink-100 border border-line'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Facility Filter */}
          <select
            value={selectedFacility}
            onChange={(e) => setSelectedFacility(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-ink-950 border border-line text-ink-200 focus:outline-none w-full sm:w-auto"
          >
            <option value="ALL">All Facilities</option>
            {uniqueFacilities.filter((f) => f !== 'ALL').map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-ink-950 border border-line text-ink-200 focus:outline-none w-full sm:w-auto"
          >
            <option value="ALL">All Types</option>
            {uniqueTypes.filter((t) => t !== 'ALL').map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search Equipment / PIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-ink-950 border border-line text-ink-100 focus:outline-none focus:ring-1 focus:ring-ember-500"
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-2.5 text-ink-500"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Main Records List */}
      {loading ? (
        <div className="py-20 text-center text-ink-400 text-sm">Loading improvement records...</div>
      ) : filteredRecords.length === 0 ? (
        <div className="panel p-12 text-center flex flex-col items-center justify-center gap-2">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full tone-emerald">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          <h3 className="text-base font-bold text-ink-100">No Unsafe Condition Logs Found</h3>
          <p className="text-xs text-ink-400 max-w-sm">
            {records.length === 0
              ? 'Great news! All inspected equipment is in good condition with zero reported unsafe items.'
              : 'No records match your selected filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRecords.map(({ inspection, improvement }) => {
            const impStatus = improvement?.status || 'OPEN';
            const isResolved = impStatus === 'RESOLVED';
            const isOverdue =
              !isResolved &&
              improvement?.target_date &&
              new Date(improvement.target_date) < new Date();
            const beforePhoto = inspection.photo_url
              ? inspection.photo_url.split(',').map((p) => p.trim()).filter(Boolean)[0] || null
              : null;

            return (
              <div
                key={inspection.id}
                className={`panel p-5 flex flex-col justify-between gap-4 border transition-all ${
                  isResolved
                    ? 'border-emerald-900/30 hover:border-emerald-700/50'
                    : isOverdue
                    ? 'border-rose-800/60 bg-rose-950/10'
                    : 'border-line hover:border-ink-700'
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold font-mono text-ink-100">
                        {inspection.equipment_no_id}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getTypeBadgeColor(inspection.equipment_type)}`}>
                        {inspection.equipment_type}
                      </span>
                      {getStatusBadge(impStatus)}
                      {isOverdue && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-400">
                      {[inspection.equipment?.facility, inspection.equipment?.area, inspection.equipment?.location]
                        .filter(Boolean)
                        .join(' · ') || 'Location N/A'}
                    </p>
                  </div>

                  <button
                    onClick={() => setViewingInspection(inspection)}
                    className="text-xs text-ink-400 hover:text-ink-100 underline shrink-0"
                  >
                    View Log
                  </button>
                </div>

                {/* Issue Description / Inspector Remarks */}
                <div className="p-3 rounded-lg bg-ink-950/60 border border-line text-xs space-y-1">
                  <span className="font-semibold text-rose-400 block uppercase tracking-wider text-[10px]">
                    Unsafe Condition Issue
                  </span>
                  <p className="text-ink-200 whitespace-pre-line leading-relaxed">
                    {improvement?.issue_description || inspection.remarks || 'Checklist item failed inspection.'}
                  </p>
                </div>

                {/* Before / After Photo Comparison */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 block mb-1">
                      Before Fix (Inspection)
                    </span>
                    {beforePhoto ? (
                      <div
                        className="relative aspect-video rounded-lg overflow-hidden border border-line bg-black cursor-pointer group"
                        onClick={() => setPreviewImage({ url: beforePhoto, title: `Before Fix: ${inspection.equipment_no_id}` })}
                      >
                        <ProtectedImage
                          src={beforePhoto}
                          alt="Before Fix"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ) : (
                      <div className="h-24 rounded-lg border border-dashed border-line flex items-center justify-center text-[10px] text-ink-600">
                        No Before Photo
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 block mb-1">
                      After Fix (Proof)
                    </span>
                    {improvement?.after_photo_url ? (
                      <div
                        className="relative aspect-video rounded-lg overflow-hidden border border-emerald-900/60 bg-black cursor-pointer group"
                        onClick={() => setPreviewImage({ url: improvement.after_photo_url!, title: `After Fix: ${inspection.equipment_no_id}` })}
                      >
                        <ProtectedImage
                          src={improvement.after_photo_url}
                          alt="After Fix"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ) : (
                      <div className="h-24 rounded-lg border border-dashed border-line flex items-center justify-center text-[10px] text-ink-500 italic">
                        Proof pending
                      </div>
                    )}
                  </div>
                </div>

                {/* Improvement Progress & PIC details */}
                <div className="pt-2 border-t border-line flex flex-wrap items-center justify-between text-xs gap-2">
                  <div className="space-y-0.5">
                    <span className="text-ink-400 block text-[11px]">
                      PIC: <strong className="text-ink-200">{improvement?.pic_name || 'Unassigned'}</strong>
                    </span>
                    {improvement?.target_date && (
                      <span className="text-ink-400 block text-[11px]">
                        Target Date: <strong className="text-ink-200">{improvement.target_date}</strong>
                      </span>
                    )}
                    {improvement?.action_taken && (
                      <span className="text-emerald-400 block text-[11px] font-medium truncate max-w-xs">
                        Fix: {improvement.action_taken}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenModal(inspection, improvement)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-transform active:scale-95 ${
                      isResolved
                        ? 'bg-ink-800 text-ink-200 hover:bg-ink-700 border border-line'
                        : 'bg-ember-600 text-white hover:bg-ember-500 shadow-md'
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                    {isResolved ? 'Edit Resolution Details' : improvement ? 'Update Progress' : 'Log Corrective Action'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Improvement Modal */}
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

      {/* Inspection Detail Modal */}
      {viewingInspection && (
        <InspectionDetailModal
          inspection={viewingInspection}
          onClose={() => setViewingInspection(null)}
        />
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <ImageModal
          imageUrl={previewImage.url}
          title={previewImage.title}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* Alert Modal */}
      <AlertModal state={alertModal} onClose={() => setAlertModal(null)} />
    </div>
  );
}
