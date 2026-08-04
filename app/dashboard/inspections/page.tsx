'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { deleteStorageFiles } from '@/app/lib/storageHelpers';

import InspectionForm from '@/app/components/inspection/InspectionForm';
import InspectionDetailModal, { InspectionRecord } from '@/app/components/inspection/InspectionDetailModal';
import { ConfirmModal, AlertModal, ConfirmState, AlertState } from '@/app/components/ui/CustomModal';

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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<InspectionRecord | null>(null);

  const supabase = getSupabaseClient();

  const checkAuthAndFetch = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push('/');
      return;
    }

    // Auto-set Inspector entity and facility from profile if logged in as inspector
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, entity, facility, pic:pic_id(entity, facility)')
      .eq('id', sessionData.session.user.id)
      .single();

    if (userProfile) {
      const assignedEntity = userProfile.entity || (userProfile.pic as any)?.entity;
      const assignedFacility = userProfile.facility || (userProfile.pic as any)?.facility;
      if (assignedEntity) setSelectedEntity(assignedEntity);
      if (assignedFacility) setSelectedFacility(assignedFacility);
    }

    const { data, error } = await supabase
      .from('inspections')
      .select(`
        *,
        equipment:equipment_id(location, facility, area, entity)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInspections(data as InspectionRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

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

  // Unique options for entity and facility
  const uniqueEntities = useMemo(() => {
    const set = new Set<string>();
    inspections.forEach(i => {
      const ent = (i.equipment as any)?.entity;
      if (ent) set.add(ent);
    });
    return ['All', ...Array.from(set).sort()];
  }, [inspections]);

  const uniqueFacilities = useMemo(() => {
    const set = new Set<string>();
    inspections.forEach(i => {
      const fac = (i.equipment as any)?.facility;
      const ent = (i.equipment as any)?.entity;
      if (fac && (selectedEntity === 'All' || ent === selectedEntity)) {
        set.add(fac);
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [inspections, selectedEntity]);

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

      const entity = (item.equipment as any)?.entity || '';
      const facility = (item.equipment as any)?.facility || '';
      const matchesEntity = selectedEntity === 'All' || entity === selectedEntity;
      const matchesFacility = selectedFacility === 'All' || facility === selectedFacility;

      return matchesSearch && matchesType && matchesStatus && matchesEntity && matchesFacility;
    });
  }, [inspections, searchQuery, selectedType, selectedStatus, selectedEntity, selectedFacility]);

  // Metrics calculation
  const totalInspections = filteredInspections.length;
  const passCount = filteredInspections.filter((i) => i.status === 'PASS').length;
  const needsAttentionCount = filteredInspections.filter((i) => i.status !== 'PASS').length;
  const passRate = totalInspections > 0 ? Math.round((passCount / totalInspections) * 100) : 100;

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
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-ember-950/60 text-ember-300 border border-ember-900/60">
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

          {/* Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="panel p-4 flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Total Inspections</span>
              <span className="text-2xl font-bold text-ink-100 mt-2">{totalInspections}</span>
              <span className="text-xs text-ink-400 mt-1">Logged records</span>
            </div>

            <div className="panel p-4 flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Pass Rate</span>
              <span className="text-2xl font-bold text-emerald-400 mt-2">{passRate}%</span>
              <span className="text-xs text-ink-400 mt-1">{passCount} passed items</span>
            </div>

            <div className="panel p-4 flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Needs Attention</span>
              <span className="text-2xl font-bold text-rose-400 mt-2">{needsAttentionCount}</span>
              <span className="text-xs text-ink-400 mt-1">Defects flagged</span>
            </div>

            <div className="panel p-4 flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Checklist Standard</span>
              <span className="text-lg font-bold text-ember-400 mt-2">100% Yes/No</span>
              <span className="text-xs text-ink-400 mt-1">Photo verified</span>
            </div>
          </div>

          {/* Filters & Search Bar */}
          <div className="panel p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, inspector..."
                className="input pl-10 text-xs"
              />
              <svg className="absolute left-3 top-3 w-4 h-4 text-ink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Entity Filter */}
              <select
                value={selectedEntity}
                onChange={(e) => { setSelectedEntity(e.target.value); setSelectedFacility('All'); }}
                className="input text-xs w-full md:w-36"
              >
                {uniqueEntities.map(e => <option key={e} value={e}>{e === 'All' ? 'All Entities' : e}</option>)}
              </select>

              {/* Facility Filter */}
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="input text-xs w-full md:w-36"
              >
                {uniqueFacilities.map(f => <option key={f} value={f}>{f === 'All' ? 'All Facilities' : f}</option>)}
              </select>

              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="input text-xs w-full md:w-40"
              >
                <option value="All">All Types</option>
                <option value="Fire Extinguisher">Fire Extinguisher</option>
                <option value="Fire Alarm">Fire Alarm</option>
                <option value="Fire Hydrant">Fire Hydrant</option>
                <option value="Emergency Lamp">Emergency Lamp</option>
                <option value="Emergency Exit Lamp">Emergency Exit Lamp</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input text-xs w-full md:w-36"
              >
                <option value="All">All Statuses</option>
                <option value="PASS">Pass Only</option>
                <option value="NEEDS_ATTENTION">Needs Attention</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="table-wrap">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
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
                      const entity = (item.equipment as any)?.entity || '';
                      const facility = (item.equipment as any)?.facility || '';
                      return (
                        <tr key={item.id} className="transition-colors hover:bg-white/[0.03]">
                          <td className="td font-bold text-ink-100">{item.equipment_no_id}</td>
                          <td className="td">
                            <span
                              className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(
                                item.equipment_type
                              )}`}
                            >
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
                            <div className="text-ink-500 text-[11px]">
                              {item.week} ({item.month_year})
                            </div>
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
                          <td className="td text-right">
                            <div className="flex items-center justify-end gap-2">
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
          </div>
        </div>
      </div>

      {/* Modal for Creating New Inspection */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 md:p-6 bg-ink-950/80 backdrop-blur-md flex justify-center items-start animate-fade">
          <div className="relative w-full max-w-4xl bg-ink-900 border border-line rounded-3xl shadow-2xl p-6 my-auto sm:my-8">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
              <h2 className="text-xl font-bold text-ink-100">Perform Live Equipment Inspection</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-ink-400 hover:text-ink-100 text-sm font-medium"
              >
                ✕ Close
              </button>
            </div>

            <InspectionForm
              onSuccess={() => {
                setShowCreateModal(false);
                checkAuthAndFetch();
              }}
              onCancel={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}

      {/* Modal for Viewing Inspection Detail */}
      <InspectionDetailModal
        inspection={viewingRecord}
        onClose={() => setViewingRecord(null)}
      />

      <ConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />
      <AlertModal state={alertModal} onClose={() => setAlertModal(null)} />
    </>
  );
}
