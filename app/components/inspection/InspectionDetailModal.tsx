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
  answers: Record<string, 'YES' | 'NO' | 'NA'>;
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
    entity?: string;
    pic_1?: { id?: string; name?: string; phone?: string | null; image_profile?: string | null; image_contact?: string | null } | null;
    pic_2?: { id?: string; name?: string; phone?: string | null; image_profile?: string | null; image_contact?: string | null } | null;
  } | null;
}

import ImageModal from '@/app/components/ui/ImageModal';
import ProtectedImage from '@/app/components/ui/ProtectedImage';
import type { ImprovementRecord } from './ImprovementModal';

interface InspectionDetailModalProps {
  inspection: InspectionRecord | null;
  onClose: () => void;
  onEdit?: (inspection: InspectionRecord) => void;
  theme?: 'light' | 'dark';
}

type ThemeTokens = {
  overlay: string;
  surface: string;
  header: string;
  headerText: string;
  typePill: string;
  statusPass: string;
  statusFail: string;
  closeBtn: string;
  metaCard: string;
  metaLabel: string;
  metaValue: string;
  docNo: string;
  sectionHeading: string;
  box: string;
  boxPlaceholder: string;
  photoBox: string;
  signatureBox: string;
  signatureBlank: string;
  checklistBar: string;
  checklistTitle: string;
  itemText: string;
  itemEn: string;
  answerNormal: string;
  answerFail: string;
  footer: string;
  footerText: string;
  footerClose: string;
};

const DARK: ThemeTokens = {
  overlay: 'bg-ink-950/80 backdrop-blur-md',
  surface: 'bg-ink-900 border-line',
  header: 'bg-ink-950/60',
  headerText: 'text-ink-100',
  typePill: 'bg-ink-800 border-line text-ink-200',
  statusPass: 'bg-emerald-950/60 text-emerald-300 border-emerald-900/60',
  statusFail: 'bg-rose-950/60 text-rose-300 border-rose-900/60',
  closeBtn: 'text-ink-400 hover:bg-ink-800 hover:text-ink-100',
  metaCard: 'border-line bg-ink-950/50',
  metaLabel: 'text-ink-500',
  metaValue: 'text-ink-100',
  docNo: 'text-ember-400',
  sectionHeading: 'text-ink-300',
  photoBox: 'border-line bg-black',
  box: 'border-line bg-ink-950/60 text-ink-200',
  boxPlaceholder: 'text-ink-600 italic',
  signatureBox: 'bg-white/5 border-line',
  signatureBlank: 'text-ink-500',
  checklistBar: 'bg-ink-950 border-line text-ink-200',
  checklistTitle: 'divide-line border-line bg-ink-950/40',
  itemText: 'text-ink-100',
  itemEn: 'text-sky-400',
  answerNormal: 'bg-emerald-950/80 text-emerald-300 border-emerald-900/60',
  answerFail: 'bg-rose-950/80 text-rose-300 border-rose-900/60',
  footer: 'bg-ink-950/60',
  footerText: 'text-ink-500',
  footerClose: 'bg-ink-800 text-ink-100 hover:bg-ink-700',
};

const LIGHT: ThemeTokens = {
  overlay: 'bg-stone-900/30 backdrop-blur-[2px]',
  surface: 'bg-white border-stone-200 shadow-2xl shadow-stone-900/10',
  header: 'bg-stone-50 border-stone-200',
  headerText: 'text-stone-900',
  typePill: 'bg-stone-100 border-stone-200 text-stone-700',
  statusPass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  statusFail: 'bg-rose-50 text-rose-700 border-rose-200',
  closeBtn: 'text-stone-400 hover:bg-stone-100 hover:text-stone-800',
  metaCard: 'border-stone-200 bg-stone-50',
  metaLabel: 'text-stone-500',
  metaValue: 'text-stone-900',
  docNo: 'text-red-800',
  sectionHeading: 'text-stone-600',
  photoBox: 'border-stone-200 bg-stone-100',
  box: 'border-stone-200 bg-stone-50 text-stone-700',
  boxPlaceholder: 'text-stone-400 italic',
  signatureBox: 'bg-white border-stone-200',
  signatureBlank: 'text-stone-400',
  checklistBar: 'bg-stone-100 border-stone-200 text-stone-700',
  checklistTitle: 'divide-stone-200 border-stone-200 bg-white',
  itemText: 'text-stone-800',
  itemEn: 'text-sky-700',
  answerNormal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  answerFail: 'bg-rose-50 text-rose-700 border-rose-200',
  footer: 'bg-stone-50',
  footerText: 'text-stone-500',
  footerClose: 'bg-stone-100 text-stone-700 hover:bg-stone-200',
};

export default function InspectionDetailModal({ inspection, onClose, onEdit, theme = 'dark' }: InspectionDetailModalProps) {
  const [inspectorSignature, setInspectorSignature] = useState<string | null>(null);
  const [improvementRecord, setImprovementRecord] = useState<ImprovementRecord | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const supabase = getSupabaseClient();

  const [prevInspectorName, setPrevInspectorName] = useState<string | undefined>(inspection?.inspector_name);
  const [prevInspectionId, setPrevInspectionId] = useState<string | undefined>(inspection?.id);
  if (prevInspectionId !== inspection?.id) {
    setPrevInspectionId(inspection?.id);
    setImprovementRecord(null);
  }
  if (prevInspectorName !== inspection?.inspector_name) {
    setPrevInspectorName(inspection?.inspector_name);
    setInspectorSignature(null);
  }

  useEffect(() => {
    if (!inspection?.id) return;

    let cancelled = false;
    const fetchDetails = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', sessionData.session.user.id)
          .single();
        if (!cancelled && profile?.role) {
          setUserRole(profile.role);
        }
      }

      if (inspection.inspector_name) {
        const { data: sigData } = await supabase
          .from('pic')
          .select('signature_url')
          .eq('name', inspection.inspector_name)
          .single();

        if (!cancelled) {
          setInspectorSignature(sigData?.signature_url || null);
        }
      }

      const { data: impData } = await supabase
        .from('improvements')
        .select('*')
        .eq('inspection_id', inspection.id)
        .maybeSingle();

      if (!cancelled) {
        setImprovementRecord(impData || null);
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [inspection, supabase]);

  if (!inspection) return null;

  const checklist = getChecklistForType(inspection.equipment_type);
  const T = theme === 'light' ? LIGHT : DARK;

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto p-4 md:p-6 ${T.overlay} flex justify-center items-start animate-fade`}>
      <div className={`relative w-full max-w-4xl ${T.surface} rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto sm:my-8`}>
        {/* Header */}
        <div className={`p-4 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${T.header} shrink-0`}>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <span className={`text-lg sm:text-xl font-bold ${T.headerText}`}>{inspection.equipment_no_id}</span>
            <span className={`text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border font-medium ${T.typePill}`}>
              {inspection.equipment_type}
            </span>
            <span
              className={`text-[11px] sm:text-xs px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-bold border ${
                inspection.status === 'PASS' ? T.statusPass : T.statusFail
              }`}
            >
              {inspection.status === 'PASS' ? '✓ PASS' : '⚠️ NEEDS ATTENTION'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {userRole === 'admin' && onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(inspection);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-ember-600/20 text-ember-400 border border-ember-500/30 hover:bg-ember-600/30 transition-colors flex items-center gap-1.5"
                title="Edit this inspection log to correct human error (Admin Only)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                Edit Log
              </button>
            )}

            <button
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${T.closeBtn}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          {/* Metadata Grid */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border text-xs ${T.metaCard}`}>
            <div>
              <span className={`${T.metaLabel} block uppercase font-semibold text-[10px]`}>Inspector</span>
              <span className={`${T.metaValue} font-medium`}>{inspection.inspector_name}</span>
            </div>
            <div>
              <span className={`${T.metaLabel} block uppercase font-semibold text-[10px]`}>Date</span>
              <span className={`${T.metaValue} font-medium`}>{inspection.inspection_date}</span>
            </div>
            <div>
              <span className={`${T.metaLabel} block uppercase font-semibold text-[10px]`}>Period</span>
              <span className={`${T.metaValue} font-medium`}>{inspection.week} ({inspection.month_year})</span>
            </div>
            <div>
              <span className={`${T.metaLabel} block uppercase font-semibold text-[10px]`}>Area / Location</span>
              <span className={`${T.metaValue} font-medium`}>
                {[inspection.equipment?.area, inspection.equipment?.location].filter(Boolean).join(' · ') || (inspection.equipment?.area || '—')}
              </span>
            </div>
            <div>
              <span className={`${T.metaLabel} block uppercase font-semibold text-[10px]`}>Form Doc No.</span>
              <span className={`${T.docNo} font-mono`}>{checklist.docNo}</span>
            </div>
          </div>

          {/* Photo, Remarks & Inspector Digital Signature */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Equipment & Checklist Photos */}
            <div className="space-y-4">
              {inspection.photo_url.split(',').map((url, idx) => (
                <div key={idx} className="space-y-2">
                  <h4 className={`text-xs font-bold ${T.sectionHeading} uppercase tracking-wider`}>
                    {idx === 0 ? 'Equipment Verification Photo (Live Captured)' : 'Printed Checklist Form Photo'}
                  </h4>
                  <div className={`rounded-2xl overflow-hidden border aspect-video flex items-center justify-center ${T.photoBox}`}>
                    <ProtectedImage
                      src={url.trim()}
                      alt={`Photo ${idx + 1} for ${inspection.equipment_no_id}`}
                      onPreview={() => setPreviewImage({ url: url.trim(), title: `${inspection.equipment_no_id} - ${idx === 0 ? 'Equipment Verification Photo' : 'Checklist Form Photo'}` })}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Remarks, Actions & Digital Signature */}
            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <h4 className={`text-xs font-bold ${T.sectionHeading} uppercase tracking-wider mb-2`}>Remarks (Keterangan)</h4>
                <div className={`p-3 rounded-xl border text-xs min-h-16 ${T.box}`}>
                  {inspection.remarks || <span className={T.boxPlaceholder}>No specific remarks recorded.</span>}
                </div>
              </div>

              <div>
                <h4 className={`text-xs font-bold ${T.sectionHeading} uppercase tracking-wider mb-2`}>Action Taken (Tindakan)</h4>
                <div className={`p-3 rounded-xl border text-xs min-h-16 ${T.box}`}>
                  {inspection.action_taken || <span className={T.boxPlaceholder}>No immediate action taken recorded.</span>}
                </div>
              </div>

              {/* Inspector Digital Signature */}
              <div className={`p-3 rounded-xl border flex items-center justify-between ${T.box}`}>
                <div>
                  <span className={`text-[10px] font-semibold ${T.metaLabel} uppercase tracking-wider block`}>Inspector Signature</span>
                  <span className={`text-xs font-bold ${T.metaValue}`}>{inspection.inspector_name}</span>
                </div>

                {inspectorSignature ? (
                  <div className={`h-12 w-28 border rounded-lg p-1 flex items-center justify-center ${T.signatureBox}`}>
                    <ProtectedImage
                      src={inspectorSignature}
                      alt="Digital Signature"
                      onPreview={() => setPreviewImage({ url: inspectorSignature, title: `${inspection.inspector_name} - Digital Signature` })}
                      className="h-full object-contain"
                    />
                  </div>
                ) : (
                  <span className={`text-[10px] italic ${T.signatureBlank}`}>No signature on file</span>
                )}
              </div>
            </div>
          </div>

          {/* Unsafe Condition Improvement Card if applicable */}
          {(inspection.status === 'NEEDS_ATTENTION' || improvementRecord) && (
            <div className={`p-4 rounded-2xl border ${T.metaCard} space-y-3`}>
              <div className="flex items-center justify-between">
                <h4 className={`text-xs font-bold ${T.sectionHeading} uppercase tracking-wider flex items-center gap-2`}>
                  🛠️ Corrective Action Plan & Improvement Record (CAPA)
                </h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  improvementRecord?.status === 'RESOLVED' ? T.answerNormal : T.answerFail
                }`}>
                  {improvementRecord?.status || 'OPEN (Needs Action)'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className={`${T.metaLabel} font-semibold block uppercase text-[10px]`}>Action Plan</span>
                  <p className={`font-medium ${T.metaValue} mt-0.5`}>{improvementRecord?.action_plan || 'No formal plan recorded yet.'}</p>
                </div>
                <div>
                  <span className={`${T.metaLabel} font-semibold block uppercase text-[10px]`}>Actual Action Implemented</span>
                  <p className={`font-medium ${T.metaValue} mt-0.5`}>{improvementRecord?.action_taken || inspection.action_taken || 'No action taken yet.'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs pt-2 border-t border-line">
                <div>
                  <span className={`${T.metaLabel} text-[10px]`}>PIC Responsible:</span>
                  <span className={`font-semibold block ${T.metaValue}`}>{improvementRecord?.pic_name || 'Unassigned'}</span>
                </div>
                <div>
                  <span className={`${T.metaLabel} text-[10px]`}>Target Date:</span>
                  <span className={`font-semibold block ${T.metaValue}`}>{improvementRecord?.target_date || 'N/A'}</span>
                </div>
                <div>
                  <span className={`${T.metaLabel} text-[10px]`}>Completion Date:</span>
                  <span className="font-semibold block text-emerald-400">{improvementRecord?.completion_date || 'Pending'}</span>
                </div>
              </div>

              {/* Before vs After Photo comparison */}
              {improvementRecord?.after_photo_url && (
                <div className="pt-2 border-t border-line">
                  <span className={`${T.metaLabel} font-semibold uppercase tracking-wider block text-[10px] mb-2`}>
                    Proof of Improvement (Before vs After)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className={`${T.metaLabel} text-[10px]`}>Before Fix</span>
                      <div className={`rounded-xl overflow-hidden border aspect-video flex items-center justify-center ${T.photoBox}`}>
                        <ProtectedImage
                          src={inspection.photo_url.split(',')[0]}
                          alt="Before Fix"
                          onPreview={() => setPreviewImage({ url: inspection.photo_url.split(',')[0], title: `Before Fix: ${inspection.equipment_no_id}` })}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-emerald-400 text-[10px]">After Fix (Proof)</span>
                      <div className={`rounded-xl overflow-hidden border border-emerald-900/60 aspect-video flex items-center justify-center ${T.photoBox}`}>
                        <ProtectedImage
                          src={improvementRecord.after_photo_url}
                          alt="After Fix"
                          onPreview={() => setPreviewImage({ url: improvementRecord.after_photo_url || '', title: `After Fix: ${inspection.equipment_no_id}` })}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Question Answers */}
          <div className="space-y-4">
            <h4 className={`text-xs font-bold ${T.sectionHeading} uppercase tracking-wider`}>Checklist Item Results</h4>

            <div className="space-y-4">
              {checklist.sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-2">
                  <div className={`px-3 py-1.5 rounded-lg border ${T.checklistBar}`}>
                    <span className="text-xs font-semibold">{section.titleId}</span>
                  </div>

                  <div className={`divide-y border rounded-xl overflow-hidden text-xs ${T.checklistTitle}`}>
                    {section.items.map((item) => {
                      const answer = inspection.answers[item.id];
                      const expected = item.expectedAnswer || 'YES';
                      const isNormal = item.allowNA && answer === 'NA'
                        ? true
                        : answer === expected;
                      return (
                        <div
                          key={item.id}
                          className={`p-3 flex items-center justify-between ${
                            item.isIndent ? 'pl-7' : ''
                          }`}
                        >
                          <div>
                            <p className={`font-medium ${T.itemText}`}>{item.labelId}</p>
                            <p className={`text-[11px] italic ${T.itemEn}`}>{item.labelEn}</p>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-md font-bold text-[11px] border ${
                              isNormal ? T.answerNormal : T.answerFail
                            }`}
                          >
                            {answer === 'YES' ? 'YA / YES' : answer === 'NA' ? 'TIDAK ADA / N/A' : 'TIDAK / NO'} ({isNormal ? 'Normal' : 'Defect'})
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
        <div className={`p-4 border-t flex items-center justify-between shrink-0 ${T.footer}`}>
          <span className={`text-xs ${T.footerText}`}>
            Recorded at {new Date(inspection.created_at).toLocaleString()}
          </span>
          <button
            onClick={onClose}
            className={`btn text-xs ${T.footerClose}`}
          >
            Close
          </button>
        </div>
      </div>

      <ImageModal
        imageUrl={previewImage?.url || null}
        title={previewImage?.title || 'Inspection Photo Preview'}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}