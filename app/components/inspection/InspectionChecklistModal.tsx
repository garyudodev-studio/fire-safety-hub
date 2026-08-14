'use client';

import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { buildInspectionPrintPages } from '@/app/lib/printInspectionResults';
import type { InspectionRecord } from './InspectionDetailModal';

interface InspectionChecklistModalProps {
  inspection: InspectionRecord | null;
  onClose: () => void;
}

export default function InspectionChecklistModal({ inspection, onClose }: InspectionChecklistModalProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inspection) return;
    let cancelled = false;

    const load = async () => {
      try {
        const supabase = getSupabaseClient();
        const sigs: Record<string, string | null> = {};
        const { data } = await supabase
          .from('pic')
          .select('signature_url')
          .eq('name', inspection.inspector_name)
          .single();
        sigs[inspection.inspector_name] = data?.signature_url || null;

        const { html: bodyHtml, header } = await buildInspectionPrintPages([inspection], sigs);
        if (!cancelled) {
          setHtml(`${header}${bodyHtml}</body></html>`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load the checklist template.');
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [inspection]);

  if (!inspection) return null;

  const handlePrint = () => {
    if (!html) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Popup blocked. Please allow popups for this site.');
      return;
    }
    const printDoc = html.replace(
      '</body>',
      `<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 500);
  });
</script>
</body>`
    );
    printWindow.document.write(printDoc);
    printWindow.document.close();
  };

  const isPass = inspection.status === 'PASS';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 md:p-6 bg-stone-900/30 backdrop-blur-[2px] flex justify-center items-start animate-fade">
      <div className="relative w-full max-w-4xl bg-white border border-stone-200 rounded-3xl shadow-2xl shadow-stone-900/10 overflow-hidden max-h-[90vh] flex flex-col my-auto sm:my-8">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base font-bold text-stone-900 truncate">{inspection.equipment_no_id}</span>
            <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
              isPass
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {isPass ? '✓ PASS' : '⚠️ NEEDS ATTENTION'}
            </span>
            <span className="text-xs text-stone-500 hidden sm:block truncate">
              {inspection.week} ({inspection.month_year}) · {inspection.inspection_date}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-800 text-white hover:bg-red-900 transition-colors flex items-center gap-1.5"
              title="Print this checklist"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-colors text-stone-400 hover:bg-stone-100 hover:text-stone-800"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-stone-100 p-3 md:p-5">
          {error ? (
            <div className="py-16 text-center text-sm text-rose-600">{error}</div>
          ) : html ? (
            <iframe
              srcDoc={html}
              title={`Checklist for ${inspection.equipment_no_id}`}
              className="w-full h-full min-h-[70vh] bg-white border border-stone-200 rounded-xl"
            />
          ) : (
            <div className="py-20 text-center text-stone-500 flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-red-800" />
              <p className="text-sm">Loading checklist…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
