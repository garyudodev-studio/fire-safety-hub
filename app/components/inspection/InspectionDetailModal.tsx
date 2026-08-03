'use client';

import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { getChecklistForType } from '@/app/lib/inspectionChecklists';

export interface InspectionRecord {
  id: string;
  equipment_id: string;
  equipment_no_id: string;
  equipment_type: string;
  inspector_name: string;
  inspection_date: string;
  week: string;
  month_year: string;
  answers: Record<string, 'YES' | 'NO'>;
  status: 'PASS' | 'NEEDS_ATTENTION' | string;
  photo_url: string;
  remarks?: string | null;
  action_taken?: string | null;
  created_at: string;
  equipment?: {
    location?: string;
    facility?: string;
    area?: string;
    area_2?: string;
  } | null;
}

interface InspectionDetailModalProps {
  inspection: InspectionRecord | null;
  onClose: () => void;
}

export default function InspectionDetailModal({ inspection, onClose }: InspectionDetailModalProps) {
  const [inspectorSignature, setInspectorSignature] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!inspection?.inspector_name) {
      setInspectorSignature(null);
      return;
    }

    const fetchSignature = async () => {
      const { data } = await supabase
        .from('pic')
        .select('signature_url')
        .eq('name', inspection.inspector_name)
        .single();

      if (data?.signature_url) {
        setInspectorSignature(data.signature_url);
      } else {
        setInspectorSignature(null);
      }
    };

    fetchSignature();
  }, [inspection]);

  if (!inspection) return null;

  const checklist = getChecklistForType(inspection.equipment_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md overflow-y-auto animate-fade">
      <div className="relative w-full max-w-4xl bg-ink-900 border border-line rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-line flex items-center justify-between bg-ink-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-ink-100">{inspection.equipment_no_id}</span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-ink-800 border border-line text-ink-200 font-medium">
              {inspection.equipment_type}
            </span>
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold border ${
                inspection.status === 'PASS'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-900/60'
                  : 'bg-rose-950/60 text-rose-300 border-rose-900/60'
              }`}
            >
              {inspection.status === 'PASS' ? '✓ PASS' : '⚠️ NEEDS ATTENTION'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-ink-400 hover:bg-ink-800 hover:text-ink-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl border border-line bg-ink-950/50 text-xs">
            <div>
              <span className="text-ink-500 block uppercase font-semibold text-[10px]">Inspector</span>
              <span className="text-ink-100 font-medium">{inspection.inspector_name}</span>
            </div>
            <div>
              <span className="text-ink-500 block uppercase font-semibold text-[10px]">Date</span>
              <span className="text-ink-100 font-medium">{inspection.inspection_date}</span>
            </div>
            <div>
              <span className="text-ink-500 block uppercase font-semibold text-[10px]">Period</span>
              <span className="text-ink-100 font-medium">{inspection.week} ({inspection.month_year})</span>
            </div>
            <div>
              <span className="text-ink-500 block uppercase font-semibold text-[10px]">Form Doc No.</span>
              <span className="text-ember-400 font-mono">{checklist.docNo}</span>
            </div>
          </div>

          {/* Photo, Remarks & Inspector Digital Signature */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Equipment Photo */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-ink-300 uppercase tracking-wider">Equipment Verification Photo (Live Captured)</h4>
              <div className="rounded-2xl overflow-hidden border border-line bg-black aspect-video flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={inspection.photo_url}
                  alt={`Photo for ${inspection.equipment_no_id}`}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Remarks, Actions & Digital Signature */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-ink-300 uppercase tracking-wider mb-2">Remarks (Keterangan)</h4>
                <div className="p-3 rounded-xl border border-line bg-ink-950/60 text-xs text-ink-200 min-h-16">
                  {inspection.remarks || <span className="text-ink-600 italic">No specific remarks recorded.</span>}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-ink-300 uppercase tracking-wider mb-2">Action Taken (Tindakan)</h4>
                <div className="p-3 rounded-xl border border-line bg-ink-950/60 text-xs text-ink-200 min-h-16">
                  {inspection.action_taken || <span className="text-ink-600 italic">No immediate action taken recorded.</span>}
                </div>
              </div>

              {/* Inspector Digital Signature */}
              <div className="p-3 rounded-xl border border-line bg-ink-950/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wider block">Inspector Signature</span>
                  <span className="text-xs font-bold text-ink-100">{inspection.inspector_name}</span>
                </div>

                {inspectorSignature ? (
                  <div className="h-12 w-28 bg-white/5 border border-line rounded-lg p-1 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={inspectorSignature} alt="Digital Signature" className="h-full object-contain" />
                  </div>
                ) : (
                  <span className="text-[10px] text-ink-500 italic">No signature on file</span>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Question Answers */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-ink-300 uppercase tracking-wider">Checklist Item Results</h4>
            
            <div className="space-y-4">
              {checklist.sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-2">
                  <div className="bg-ink-950 px-3 py-1.5 rounded-lg border border-line">
                    <span className="text-xs font-semibold text-ink-200">{section.titleId}</span>
                  </div>

                  <div className="divide-y divide-line rounded-xl border border-line bg-ink-950/40 overflow-hidden text-xs">
                    {section.items.map((item) => {
                      const answer = inspection.answers[item.id];
                      const expected = item.expectedAnswer || 'YES';
                      const isNormal = answer === expected;
                      return (
                        <div
                          key={item.id}
                          className={`p-3 flex items-center justify-between ${
                            item.isIndent ? 'pl-7' : ''
                          }`}
                        >
                          <div>
                            <p className="text-ink-100 font-medium">{item.labelId}</p>
                            <p className="text-[11px] text-sky-400 italic">{item.labelEn}</p>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-md font-bold text-[11px] ${
                              isNormal
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-900/60'
                                : 'bg-rose-950/80 text-rose-300 border border-rose-900/60'
                            }`}
                          >
                            {answer === 'YES' ? 'YA / YES' : 'TIDAK / NO'} ({isNormal ? 'Normal' : 'Defect'})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-line bg-ink-950/60 flex items-center justify-between shrink-0">
          <span className="text-xs text-ink-500">
            Recorded at {new Date(inspection.created_at).toLocaleString()}
          </span>
          <button
            onClick={onClose}
            className="btn btn-ghost text-xs bg-ink-800 text-ink-100 hover:bg-ink-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
