'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import InspectionDetailModal, { InspectionRecord } from '@/app/components/inspection/InspectionDetailModal';

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
  no_id: string;
  type: string;
  location: string;
  facility: string;
  area: string;
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

export default function GuestDashboard() {
  const [activeTab, setActiveTab] = useState<'masterlist' | 'inspections'>('masterlist');
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRecord, setViewingRecord] = useState<InspectionRecord | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
        .order('updated_at', { ascending: false })
        .limit(100);

      if (eqData) setEquipment(eqData as EquipmentRow[]);

      // Fetch Inspection Logs
      const { data: inspData } = await supabase
        .from('inspections')
        .select(`
          *,
          equipment:equipment_id(location, facility, area)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (inspData) setInspections(inspData as InspectionRecord[]);

      setLoading(false);
    };

    fetchData();
  }, []);

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
                  Read Only
                </span>
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-ink-100 md:text-2xl">
                Fire Safety Equipment & Inspections
              </h1>
              <p className="mt-0.5 text-sm text-ink-400">Public viewer for masterlist items and completed inspection logs.</p>
            </div>
          </div>
          <Link href="/" className="btn btn-ghost text-xs">
            <ArrowLeft /> Back to Login
          </Link>
        </header>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <button
            onClick={() => setActiveTab('masterlist')}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'masterlist'
                ? 'bg-ink-800 text-ember-400 border border-line shadow-sm'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Equipment Masterlist ({equipment.length})
          </button>
          <button
            onClick={() => setActiveTab('inspections')}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'inspections'
                ? 'bg-ink-800 text-ember-400 border border-line shadow-sm'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Inspection Logs & Checklists ({inspections.length})
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-ink-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500" />
            <p className="text-sm">Loading records…</p>
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
                    <th className="th">Location</th>
                    <th className="th">Facility / Area</th>
                    <th className="th">PIC</th>
                    <th className="th">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {equipment.map((item) => (
                    <tr key={item.no_id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="td"><span className="id-pill">{item.no_id}</span></td>
                      <td className="td">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(item.type)}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="td text-ink-200">{item.location}</td>
                      <td className="td text-sm text-ink-400">
                        {item.facility} <span className="text-ink-600">—</span> {item.area}
                      </td>
                      <td className="td text-sm text-ink-300">
                        {item.pic_1?.name || <span className="text-ink-600">Unassigned</span>}
                      </td>
                      <td className="td text-sm text-ink-500">
                        {new Date(item.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {equipment.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-ink-500">
                        No equipment records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Inspection Logs Table (Read Only) */
          <div className="table-wrap">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line bg-ink-950/40">
                    <th className="th">Equipment ID</th>
                    <th className="th">Type</th>
                    <th className="th">Date</th>
                    <th className="th">Inspector</th>
                    <th className="th">Status</th>
                    <th className="th">Equipment Photo</th>
                    <th className="th text-right">View Checklist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {inspections.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="td font-bold text-ink-100">{item.equipment_no_id}</td>
                      <td className="td">
                        <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs font-medium ${getTypeBadgeColor(item.equipment_type)}`}>
                          {item.equipment_type}
                        </span>
                      </td>
                      <td className="td text-xs text-ink-300">{item.inspection_date}</td>
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
                          <img src={item.photo_url} alt="Equipment Photo" className="w-full h-full object-cover" />
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
                  {inspections.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-ink-500">
                        No inspection records available to view.
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
    </div>
  );
}
