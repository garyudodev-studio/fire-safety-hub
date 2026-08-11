'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import CameraCapture from './CameraCapture';
import ProtectedImage from '@/app/components/ui/ProtectedImage';
import ImageModal from '@/app/components/ui/ImageModal';
import { InspectionRecord } from './InspectionDetailModal';
import { getChecklistForType } from '@/app/lib/inspectionChecklists';

export interface ImprovementRecord {
  id: string;
  inspection_id: string;
  equipment_id: string | null;
  issue_description: string | null;
  action_plan: string | null;
  action_taken: string | null;
  pic_name: string | null;
  target_date: string | null;
  completion_date: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | string;
  before_photo_url: string | null;
  after_photo_url: string | null;
  created_at?: string;
  updated_at?: string;
  inspection?: InspectionRecord | null;
}

interface ImprovementModalProps {
  inspection: InspectionRecord | null;
  existingImprovement?: ImprovementRecord | null;
  onClose: () => void;
  onSuccess: () => void;
  theme?: 'dark' | 'light';
}

export default function ImprovementModal({
  inspection,
  existingImprovement,
  onClose,
  onSuccess,
  theme = 'dark',
}: ImprovementModalProps) {
  const supabase = getSupabaseClient();

  const [issueDescription, setIssueDescription] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [picName, setPicName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<'OPEN' | 'IN_PROGRESS' | 'RESOLVED'>('OPEN');
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null);
  
  const [picOptions, setPicOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Derive failed checklist questions from inspection answers
  const failedItems = React.useMemo(() => {
    if (!inspection?.answers || !inspection.equipment_type) return [];
    const cl = getChecklistForType(inspection.equipment_type);
    const failed: string[] = [];
    cl.sections.forEach((sec) => {
      sec.items.forEach((item) => {
        const val = inspection.answers[item.id];
        const exp = item.expectedAnswer || 'YES';
        if (val && val !== exp && !(item.allowNA && val === 'NA')) {
          failed.push(`${item.labelEn} (${item.labelId})`);
        }
      });
    });
    return failed;
  }, [inspection]);

  const beforePhoto = inspection?.photo_url
    ? inspection.photo_url.split(',').map((p) => p.trim()).filter(Boolean)[0] || null
    : null;

  // Load PIC list and populate initial form data
  useEffect(() => {
    const initData = async () => {
      // Load PIC options
      const { data: pics } = await supabase.from('pic').select('name').order('name');
      if (pics) {
        setPicOptions(pics.map((p: { name: string }) => p.name));
      }

      // Check current user name if available
      const { data: sessionData } = await supabase.auth.getSession();
      let defaultPic = inspection?.inspector_name || '';
      if (sessionData?.session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('pic:pic_id(name)')
          .eq('id', sessionData.session.user.id)
          .single();
        if (profile?.pic?.name) {
          defaultPic = profile.pic.name;
        }
      }

      if (existingImprovement) {
        setIssueDescription(existingImprovement.issue_description || '');
        setActionPlan(existingImprovement.action_plan || '');
        setActionTaken(existingImprovement.action_taken || '');
        setPicName(existingImprovement.pic_name || defaultPic);
        setTargetDate(existingImprovement.target_date || '');
        setStatus(
          existingImprovement.status === 'IN_PROGRESS' || existingImprovement.status === 'RESOLVED'
            ? existingImprovement.status
            : 'OPEN'
        );
        setAfterPhotoUrl(existingImprovement.after_photo_url || null);
      } else {
        // Auto generate issue description from failed checklist items & inspection remarks
        let autoIssue = failedItems.length > 0
          ? `Failed Check Items:\n• ${failedItems.join('\n• ')}`
          : 'Unsafe Condition identified during inspection.';
        if (inspection?.remarks) {
          autoIssue += `\n\nInspector Remarks: ${inspection.remarks}`;
        }
        setIssueDescription(autoIssue);
        setActionPlan('');
        setActionTaken(inspection?.action_taken || '');
        setPicName(defaultPic);
        
        // Default target date = 7 days from inspection or today
        const baseDate = inspection?.inspection_date ? new Date(inspection.inspection_date) : new Date();
        baseDate.setDate(baseDate.getDate() + 7);
        setTargetDate(baseDate.toISOString().split('T')[0]);
        
        setStatus('OPEN');
        setAfterPhotoUrl(null);
      }
    };

    initData();
  }, [inspection, existingImprovement, failedItems, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspection) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      let finalAfterPhoto = afterPhotoUrl;

      // Upload Base64 photo to Supabase storage bucket if captured live
      if (afterPhotoUrl && afterPhotoUrl.startsWith('data:image')) {
        const match = afterPhotoUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const base64Data = match[2];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });

          const fileName = `improvement_after_${inspection.equipment_no_id}_${Date.now()}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from('inspection_photos')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

          if (uploadErr) throw new Error(`Photo upload failed: ${uploadErr.message}`);

          const { data: publicUrlData } = supabase.storage
            .from('inspection_photos')
            .getPublicUrl(fileName);

          finalAfterPhoto = publicUrlData.publicUrl;
        }
      }

      const isResolved = status === 'RESOLVED';
      const completionDate = isResolved ? new Date().toISOString().split('T')[0] : null;

      const payload = {
        inspection_id: inspection.id,
        equipment_id: inspection.equipment_id || null,
        issue_description: issueDescription,
        action_plan: actionPlan,
        action_taken: actionTaken,
        pic_name: picName,
        target_date: targetDate || null,
        completion_date: completionDate,
        status: status,
        before_photo_url: inspection.photo_url || null,
        after_photo_url: finalAfterPhoto,
        updated_at: new Date().toISOString(),
      };

      if (existingImprovement?.id) {
        const { error } = await supabase
          .from('improvements')
          .update(payload)
          .eq('id', existingImprovement.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('improvements')
          .insert([payload]);
        if (error) throw error;
      }

      // Also sync action_taken and remarks back to inspection table record
      if (actionTaken || isResolved) {
        await supabase
          .from('inspections')
          .update({
            action_taken: actionTaken || (isResolved ? 'Improvement action verified and resolved.' : null),
            updated_at: new Date().toISOString(),
          })
          .eq('id', inspection.id);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save improvement record.');
    } finally {
      setSaving(false);
    }
  };

  if (!inspection) return null;

  const isLight = theme === 'light';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/70 backdrop-blur-sm">
      <div
        className={`relative w-full max-w-3xl rounded-xl border shadow-2xl overflow-hidden my-8 ${
          isLight ? 'bg-white border-stone-200 text-stone-900' : 'bg-ink-900 border-line text-ink-100'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isLight ? 'bg-stone-50 border-stone-200' : 'bg-ink-950/70 border-line'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </span>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Unsafe Condition Improvement (CAPA)
                <span className="text-xs px-2 py-0.5 rounded font-mono font-bold tone-ember">
                  {inspection.equipment_no_id}
                </span>
              </h2>
              <p className="text-xs text-ink-400">
                {inspection.equipment_type} · Date: {inspection.inspection_date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-400 hover:text-ink-100 hover:bg-white/10 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Quick summary of inspection unsafe condition */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-ink-950/50 border-line'}`}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 block mb-2">
                Unsafe Inspection Photo (Before Fix)
              </span>
              {beforePhoto ? (
                <div
                  className="relative aspect-video rounded-lg overflow-hidden border border-line bg-black cursor-pointer group"
                  onClick={() => setPreviewImage({ url: beforePhoto, title: `Before Fix: ${inspection.equipment_no_id}` })}
                >
                  <ProtectedImage
                    src={beforePhoto}
                    alt="Unsafe Condition Before"
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                  />
                  <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 px-2 py-0.5 rounded text-white font-mono">
                    Click to enlarge
                  </span>
                </div>
              ) : (
                <div className="h-32 rounded-lg border border-dashed border-line flex items-center justify-center text-xs text-ink-500">
                  No photo attached
                </div>
              )}
            </div>

            <div className={`p-4 rounded-lg border ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-ink-950/50 border-line'} space-y-3`}>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 block">
                  Equipment Location
                </span>
                <p className="text-sm font-medium text-ink-100 mt-0.5">
                  {[inspection.equipment?.facility, inspection.equipment?.area, inspection.equipment?.location].filter(Boolean).join(' · ') || 'N/A'}
                </p>
              </div>

              {failedItems.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400 block mb-1">
                    Failed Checklist Items ({failedItems.length})
                  </span>
                  <ul className="text-xs text-rose-300 space-y-1 list-disc list-inside bg-rose-950/40 p-2.5 rounded border border-rose-900/50">
                    {failedItems.map((fi, idx) => (
                      <li key={idx} className="truncate">{fi}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
                Issue / Unsafe Condition Summary <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-ember-500 ${
                  isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-ink-950 border-line text-ink-100'
                }`}
                placeholder="Describe the unsafe condition observed..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Proposed Action Plan
                </label>
                <textarea
                  rows={3}
                  value={actionPlan}
                  onChange={(e) => setActionPlan(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-ember-500 ${
                    isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-ink-950 border-line text-ink-100'
                  }`}
                  placeholder="Steps to be taken to rectify the issue..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Actual Action Taken / Fix Implemented
                </label>
                <textarea
                  rows={3}
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-ember-500 ${
                    isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-ink-950 border-line text-ink-100'
                  }`}
                  placeholder="Record final repair or replacement done..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Responsible PIC
                </label>
                <select
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-ember-500 ${
                    isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-ink-950 border-line text-ink-100'
                  }`}
                >
                  <option value="">-- Select Person Responsible --</option>
                  {picOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Target Resolution Date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-ember-500 ${
                    isLight ? 'bg-white border-stone-300 text-stone-900' : 'bg-ink-950 border-line text-ink-100'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Resolution Status <span className="text-rose-400">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED')}
                  className={`w-full px-3 py-2 rounded-lg border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ember-500 ${
                    status === 'RESOLVED'
                      ? 'tone-emerald border-emerald-700'
                      : status === 'IN_PROGRESS'
                      ? 'tone-amber border-amber-700'
                      : 'tone-rose border-rose-700'
                  }`}
                >
                  <option value="OPEN" className="bg-ink-900 text-rose-300">OPEN (Needs Action)</option>
                  <option value="IN_PROGRESS" className="bg-ink-900 text-amber-300">IN_PROGRESS (Repairing)</option>
                  <option value="RESOLVED" className="bg-ink-900 text-emerald-300">RESOLVED (Fixed & Verified)</option>
                </select>
              </div>
            </div>

            {/* Proof of Improvement Photo ("After" photo) */}
            <div className={`p-4 rounded-lg border ${isLight ? 'bg-stone-50 border-stone-200' : 'bg-ink-950/50 border-line'}`}>
              <CameraCapture
                photoUrl={afterPhotoUrl}
                onPhotoCaptured={(url) => setAfterPhotoUrl(url)}
                onPhotoCleared={() => setAfterPhotoUrl(null)}
                title="Proof of Improvement Photo (After Repair)"
                description="Capture or attach live photo showing rectified equipment / resolved unsafe condition."
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                isLight ? 'bg-stone-100 text-stone-700 hover:bg-stone-200' : 'bg-ink-800 text-ink-200 hover:bg-ink-700'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-ember-600 text-white hover:bg-ember-500 shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Saving Improvement...' : existingImprovement ? 'Update Improvement' : 'Save Improvement Action'}
            </button>
          </div>
        </form>
      </div>

      {previewImage && (
        <ImageModal
          imageUrl={previewImage.url}
          title={previewImage.title}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
