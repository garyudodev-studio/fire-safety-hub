'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { buildInspectionPrintPages } from '@/app/lib/printInspectionResults';
import type { InspectionRecord } from './InspectionDetailModal';

interface InspectionChecklistModalProps {
  inspection: InspectionRecord | null;
  allInspections?: InspectionRecord[];
  onClose: () => void;
}

export default function InspectionChecklistModal({ inspection, allInspections, onClose }: InspectionChecklistModalProps) {
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!inspection) return;
    let cancelled = false;

    const load = async () => {
      try {
        const supabase = getSupabaseClient();

        // ── Resolve previous week inspection for the same month ──
        let pool = allInspections || [];

        let sameMonth = pool.filter(
          (i) => i.equipment_id === inspection.equipment_id && i.month_year === inspection.month_year
        );

        if (sameMonth.length <= 1) {
          const { data: monthData } = await supabase
            .from('inspections')
            .select(`*, equipment:equipment_id(location, facility, area, entity, pic_1:pic_1_id(id, name, phone, image_profile, image_contact), pic_2:pic_2_id(id, name, phone, image_profile, image_contact))`)
            .eq('equipment_id', inspection.equipment_id)
            .eq('month_year', inspection.month_year);

          if (monthData && monthData.length > 0) {
            sameMonth = monthData as InspectionRecord[];
            // merge into pool if needed
            pool = [...pool, ...sameMonth];
          }
        }

        sameMonth.sort((a, b) => {
          const wA = parseInt(a.week) || 0;
          const wB = parseInt(b.week) || 0;
          if (wA !== wB) return wA - wB;
          return (a.inspection_date || '').localeCompare(b.inspection_date || '');
        });

        const rightInsp = sameMonth.length > 0 ? sameMonth[sameMonth.length - 1] : inspection;
        const leftInsp = sameMonth.length > 1 ? sameMonth[sameMonth.length - 2] : null;

        // Fetch signatures for all inspectors present
        const inspectors = Array.from(
          new Set([rightInsp.inspector_name, leftInsp?.inspector_name].filter(Boolean) as string[])
        );

        const sigs: Record<string, string | null> = {};
        if (inspectors.length > 0) {
          const { data } = await supabase
            .from('pic')
            .select('name, signature_url')
            .in('name', inspectors);
          if (data) {
            data.forEach((p: { name: string; signature_url?: string | null }) => {
              if (p.name) sigs[p.name] = p.signature_url || null;
            });
          }
        }

        const { html: bodyHtml, header } = await buildInspectionPrintPages([inspection], sigs, pool);
        if (!cancelled) {
          // Mobile fallback: scale the fixed-width (210mm) A4 page to fit small screens.
          const mobileStyle = `
<style>
  @media (max-width: 767px) {
    html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
    body { zoom: 0.48; }
    .a4-container { box-shadow: none !important; margin: 0 auto !important; }
  }
</style>`;
          setHtml(`${header.replace('</head>', mobileStyle)}${bodyHtml}</body></html>`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load the checklist template.');
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [inspection, allInspections]);

  // Scale the A4 page precisely to the iframe width on any screen size.
  const handleIframeLoad = () => {
    const frame = iframeRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc || !doc.body) return;
    // 210mm A4 width ≈ 793.7px at 96dpi
    const nativeWidth = 793.7;
    const scale = Math.min(1, frame.clientWidth / nativeWidth);
    if (scale >= 1) return;
    doc.body.style.zoom = String(scale);
    doc.body.style.width = '100%';
  };

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
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex flex-wrap items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-base font-bold text-stone-900 truncate">{inspection.equipment_no_id}</span>
            <span className={`text-xs px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap ${
              isPass
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {isPass ? '✓ PASS' : '⚠️ NEEDS ATTENTION'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-stone-500 truncate sm:hidden">
              {inspection.week} ({inspection.month_year})
            </span>
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
              ref={iframeRef}
              srcDoc={html}
              title={`Checklist for ${inspection.equipment_no_id}`}
              onLoad={handleIframeLoad}
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
