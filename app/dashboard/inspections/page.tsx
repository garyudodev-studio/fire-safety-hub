'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';

import InspectionForm from '@/app/components/inspection/InspectionForm';
import InspectionDetailModal, { InspectionRecord } from '@/app/components/inspection/InspectionDetailModal';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

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

    const { data, error } = await supabase
      .from('inspections')
      .select(`
        *,
        equipment:equipment_id(location, facility, area)
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

  const handleDelete = async (id: string, noId: string) => {
    if (!confirm(`Are you sure you want to delete inspection log for ${noId}?`)) return;

    const { error } = await supabase.from('inspections').delete().eq('id', id);
    if (!error) {
      setInspections((prev) => prev.filter((item) => item.id !== id));
    } else {
      alert(`Failed to delete: ${error.message}`);
    }
  };

  // Metrics calculation
  const totalInspections = inspections.length;
  const passCount = inspections.filter((i) => i.status === 'PASS').length;
  const needsAttentionCount = inspections.filter((i) => i.status !== 'PASS').length;
  const passRate = totalInspections > 0 ? Math.round((passCount / totalInspections) * 100) : 100;

  // Filtered Inspections
  const filteredInspections = inspections.filter((item) => {
    const matchesSearch =
      item.equipment_no_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.inspector_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.equipment_type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === 'All' || item.equipment_type === selectedType;
    const matchesStatus =
      selectedStatus === 'All' ||
      (selectedStatus === 'PASS' && item.status === 'PASS') ||
      (selectedStatus === 'NEEDS_ATTENTION' && item.status !== 'PASS');

    return matchesSearch && matchesType && matchesStatus;
  });

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
              className="btn btn-primary text-xs px-5 py-2.5 flex items-center gap-2 shadow-lg shadow-ember-950/40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <div className="relative w-full md:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID or Inspector..."
                className="input pl-10 text-xs"
              />
              <svg className="absolute left-3 top-3 w-4 h-4 text-ink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="input text-xs w-full md:w-48"
              >
                <option value="All">All Types</option>
                <option value="Fire Extinguisher">Fire Extinguisher</option>
                <option value="Fire Alarm">Fire Alarm</option>
                <option value="Fire Hydrant">Fire Hydrant</option>
                <option value="Emergency Lamp">Emergency Lamp</option>
                <option value="Emergency Exit Lamp">Emergency Exit Lamp</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input text-xs w-full md:w-40"
              >
                <option value="All">All Statuses</option>
                <option value="PASS">Pass Only</option>
                <option value="NEEDS_ATTENTION">Needs Attention</option>
              </select>
            </div>
          </div>

          {/* Inspections Table */}
          {loading ? (
            <div className="py-20 text-center text-ink-500 flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500" />
              <p className="text-sm">Loading inspection logs...</p>
            </div>
          ) : (
            <div className="table-wrap">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line bg-ink-950/40">
                      <th className="th">Equipment ID</th>
                      <th className="th">Type</th>
                      <th className="th">Date / Period</th>
                      <th className="th">Inspector</th>
                      <th className="th">Status</th>
                      <th className="th">Photo Verification</th>
                      <th className="th text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredInspections.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-white/[0.03]">
                        <td className="td font-bold text-ink-100">{item.equipment_no_id}</td>
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
                          <div
                            onClick={() => setViewingRecord(item)}
                            className="w-12 h-9 rounded-lg overflow-hidden border border-line bg-black cursor-pointer hover:ring-2 hover:ring-ember-500 transition-all"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.photo_url.split(',')[0].trim()}
                              alt="Equipment"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </td>
                        <td className="td text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewingRecord(item)}
                              className="btn btn-ghost text-xs px-2.5 py-1 text-ink-300 hover:text-ink-100"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.equipment_no_id)}
                              className="btn btn-ghost text-xs px-2.5 py-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredInspections.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-ink-500">
                          No inspection records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Perform New Inspection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md overflow-y-auto animate-fade">
          <div className="relative w-full max-w-4xl bg-ink-900 border border-line rounded-3xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] my-8">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-ink-100">Perform Masterlist Equipment Inspection</h2>
                <p className="text-xs text-ink-400 mt-0.5">Personnel Only • Requires mandatory equipment photo</p>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl text-ink-400 hover:bg-ink-800 hover:text-ink-100 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
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

      {/* View Detail Modal */}
      <InspectionDetailModal
        inspection={viewingRecord}
        onClose={() => setViewingRecord(null)}
      />
    </>
  );
}
