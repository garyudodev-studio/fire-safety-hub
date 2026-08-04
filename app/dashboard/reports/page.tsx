'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
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

export default function ReportsPage() {
  const router = useRouter();
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  
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

  // Filtered Inspections
  const filteredInspections = inspections.filter((item) => {
    const matchesSearch =
      item.equipment_no_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.inspector_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.equipment_type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === 'All' || item.equipment_type === selectedType;

    return matchesSearch && matchesType;
  });

  // Metrics calculation based on filtered data
  const totalInspections = filteredInspections.length;
  const safeCount = filteredInspections.filter((i) => i.status === 'PASS').length;
  const unsafeCount = filteredInspections.filter((i) => i.status !== 'PASS').length;
  const passRate = totalInspections > 0 ? Math.round((safeCount / totalInspections) * 100) : 100;

  // Unsafe only table
  const unsafeInspections = filteredInspections.filter(i => i.status !== 'PASS');

  return (
    <>
      <div className="p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink-100 mt-1">
                Inspection Reports
              </h1>
              <p className="text-xs text-ink-400 mt-0.5">
                Analyze safety conditions and monitor equipment that needs immediate attention.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID or Inspector..."
                className="input text-xs w-full md:w-64"
              />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="input text-xs w-full md:w-48"
              >
                <option value="All">All Equipment Types</option>
                <option value="Fire Extinguisher">Fire Extinguisher</option>
                <option value="Fire Alarm">Fire Alarm</option>
                <option value="Fire Hydrant">Fire Hydrant</option>
                <option value="Emergency Lamp">Emergency Lamp</option>
                <option value="Emergency Exit Lamp">Emergency Exit Lamp</option>
              </select>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="panel p-6 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Total Inspections</span>
              <span className="text-4xl font-bold text-ink-100 mt-3">{totalInspections}</span>
              <span className="text-xs text-ink-400 mt-2">Overall reports logged</span>
            </div>

            <div className="panel p-6 flex flex-col items-center justify-center text-center border-emerald-900/30">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">Safe Conditions</span>
              <span className="text-4xl font-bold text-emerald-400 mt-3">{safeCount}</span>
              <span className="text-xs text-ink-400 mt-2">Equipments marked PASS</span>
            </div>

            <div className="panel p-6 flex flex-col items-center justify-center text-center border-rose-900/30">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-500">Needs Attention</span>
              <span className="text-4xl font-bold text-rose-400 mt-3">{unsafeCount}</span>
              <span className="text-xs text-ink-400 mt-2">Action required</span>
            </div>

            <div className="panel p-6 flex flex-col items-center justify-center text-center border-ember-900/30">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ember-500">Pass Rate</span>
              <span className="text-4xl font-bold text-ember-400 mt-3">{passRate}%</span>
              <span className="text-xs text-ink-400 mt-2">Health score</span>
            </div>
          </div>

          {/* Follow-up Required Table */}
          <div className="panel p-0 overflow-hidden mt-8 border-rose-900/30">
            <div className="p-4 border-b border-line bg-rose-950/20">
              <h2 className="text-sm font-bold text-rose-400 uppercase tracking-wider">Unsafe Conditions (Immediate Follow-up Required)</h2>
            </div>
            {loading ? (
              <div className="py-20 text-center text-ink-500 flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-rose-500" />
                <p className="text-sm">Loading reports...</p>
              </div>
            ) : unsafeInspections.length === 0 ? (
              <div className="py-16 text-center text-ink-500">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-950/50 text-emerald-400 mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm">Great news! No unsafe conditions found.</p>
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
                        <th className="th">Remarks</th>
                        <th className="th text-right">View Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {unsafeInspections.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-white/[0.03]">
                          <td className="td font-bold text-rose-200">{item.equipment_no_id}</td>
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
                          <td className="td text-xs text-rose-300 max-w-xs truncate">
                            {item.remarks || 'No remarks provided'}
                          </td>
                          <td className="td text-right">
                            <button
                              onClick={() => setViewingRecord(item)}
                              className="btn btn-ghost text-xs px-3 py-1 text-rose-400 hover:bg-rose-950/50"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
