// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportPrintRecord {
  id: string;
  equipment_id: string;
  equipment_no_id: string;
  equipment_type: string;
  inspector_name: string;
  inspection_date: string;
  week: string;
  month_year: string;
  status?: string;
  remarks?: string | null;
  action_taken?: string | null;
  photo_url?: string | null;
  equipment?: {
    entity?: string | null;
    facility?: string | null;
    area?: string | null;
    location?: string | null;
  } | null;
}

export interface ResultReportPrintOptions {
  records: ReportPrintRecord[];
  entity: string;
  facility: string;
  period: string;
  safeCount: number;
  unsafeCount: number;
  passRate: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTypeBadgeStyle(type: string): string {
  switch (type) {
    case 'Fire Alarm':          return '#dc2626';
    case 'Fire Hydrant':        return '#0284c7';
    case 'Fire Extinguisher':   return '#ea580c';
    case 'Emergency Lamp':      return '#d97706';
    default:                    return '#52525b';
  }
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatReportDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = INDONESIAN_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function absolutizePaths(html: string): string {
  const origin = window.location.origin;
  return html.replace(/(src|href)="\/(?!\/)/g, `$1="${origin}/`);
}

// ─── Build HTML ──────────────────────────────────────────────────────────────

const PAGE_STYLES = `
<style>
  @page {
    size: A4 landscape;
    margin: 8mm 9mm 12mm;
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 8px;
      color: #94a3b8;
      font-family: Arial, sans-serif;
    }
    @bottom-left {
      content: "PT YONGJIN JAVASUKA GARMENT — Inspection Result Report";
      font-size: 8px;
      color: #94a3b8;
      font-family: Arial, sans-serif;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
  body { background: #e5e7eb; padding: 24px; }

  .page {
    background: #ffffff;
    width: 279mm;
    min-height: 190mm;
    margin: 0 auto;
    padding: 10mm 11mm;
    box-shadow: 0 12px 40px rgba(15, 23, 42, 0.22);
    border-radius: 6px;
  }
  .no-break { page-break-inside: avoid; }

  /* ══ Cool header — dark navy gradient + ember accent ══ */
  .report-header {
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 18px 14px;
    border-radius: 12px;
    overflow: hidden;
    background: linear-gradient(100deg, #0d1526 0%, #16233f 48%, #20345f 100%);
    color: #ffffff;
    box-shadow: 0 6px 18px rgba(13, 21, 38, 0.35);
  }
  .report-header::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(120% 180% at 100% 0%, rgba(230, 70, 60, 0.20) 0%, transparent 55%),
      radial-gradient(90% 140% at 0% 100%, rgba(56, 90, 160, 0.35) 0%, transparent 60%);
    pointer-events: none;
  }
  .report-header::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 4px;
    background: linear-gradient(90deg, #e6463c, #f59e0b 55%, #fbbf24);
  }
  .report-logo {
    position: relative;
    width: 58px;
    height: 58px;
    border-radius: 12px;
    background: #ffffff;
    padding: 5px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  }
  .report-logo img { width: 100%; height: 100%; object-fit: contain; }
  .report-title-block { flex: 1; min-width: 0; position: relative; }
  .report-company {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #ffd9c9;
  }
  .report-title {
    font-size: 23px;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #ffffff;
    line-height: 1.1;
    margin-top: 3px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  }
  .report-subtitle {
    font-size: 9px;
    color: #b9c8e4;
    margin-top: 4px;
    font-style: italic;
  }
  .report-docno {
    position: relative;
    text-align: right;
    font-size: 8px;
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 10px;
    padding: 7px 13px;
    flex-shrink: 0;
    min-width: 150px;
  }
  .report-docno .docno-label {
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #8fa3c8;
  }
  .report-docno .docno-value {
    font-size: 11px;
    font-weight: 800;
    color: #ffffff;
    font-family: "Courier New", monospace;
    margin: 2px 0 6px;
    letter-spacing: 0.02em;
  }
  .report-docno .docno-row { margin-top: 3px; color: #b9c8e4; }
  .report-docno .docno-row b { color: #ffffff; font-weight: 700; }

  /* ── Meta strip ── */
  .meta-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .meta-box {
    flex: 1 1 0;
    min-width: 125px;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #94a3b8;
    border-radius: 8px;
    padding: 7px 11px;
    background: #f8fafc;
  }
  .meta-box .meta-label {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #94a3b8;
    text-transform: uppercase;
  }
  .meta-box .meta-value {
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    margin-top: 3px;
  }
  .meta-box.accent { border-left-color: #dc2626; background: #fef2f2; }
  .meta-box.accent .meta-value { color: #b91c1c; }
  .meta-box.green { border-left-color: #16a34a; background: #f0fdf4; }
  .meta-box.green .meta-value { color: #15803d; }
  .meta-box.amber { border-left-color: #d97706; background: #fffbeb; }
  .meta-box.amber .meta-value { color: #b45309; }
  .meta-box.sky { border-left-color: #0284c7; background: #f0f9ff; }
  .meta-box.sky .meta-value { color: #0369a1; }

  /* ── Table ── */
  table.report-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
    font-size: 9px;
  }
  table.report-table thead th {
    background: linear-gradient(90deg, #16233f, #1f3461);
    color: #ffffff;
    padding: 7px 8px;
    text-align: left;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border: 1px solid #16233f;
  }
  table.report-table tbody td {
    padding: 5px 8px;
    border: 1px solid #e2e8f0;
    vertical-align: middle;
    color: #374151;
  }
  table.report-table tbody tr:nth-child(even) { background: #f8fafc; }
  table.report-table tbody tr { page-break-inside: avoid; }
  table.report-table thead { display: table-header-group; }
  .photo-cell img {
    width: 46px;
    height: 34px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
    display: block;
    background: #f1f5f9;
  }
  .photo-empty {
    width: 46px;
    height: 34px;
    border-radius: 4px;
    border: 1px dashed #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #cbd5e1;
    font-size: 7px;
    background: #f8fafc;
  }
  .status-pass {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #86efac;
    white-space: nowrap;
  }
  .status-fail {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    background: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
    white-space: nowrap;
  }
  .type-chip {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 8px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
  }
  .id-cell { font-weight: 700; color: #0f172a; font-family: "Courier New", monospace; font-size: 10px; }
  .dim { color: #64748b; font-size: 8px; }
  .remarks-cell { max-width: 150px; word-break: break-word; }

  /* ── Footer ── */
  .report-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 20px;
    margin-top: 18px;
    padding-top: 10px;
    border-top: 1px solid #cbd5e1;
  }
  .report-footer .note { font-size: 8px; color: #64748b; max-width: 55%; line-height: 1.5; }
  .signature-block { text-align: center; font-size: 9px; color: #475569; flex-shrink: 0; }
  .signature-block .sig-space { height: 54px; }
  .signature-block .sig-line { border-bottom: 1px solid #475569; width: 160px; margin: 0 auto 4px; }
  .signature-block b { font-size: 10px; color: #0f172a; display: block; }

  @media print {
    @page {
      margin: 8mm 9mm 12mm;
    }
    html, body {
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .page {
      width: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
</style>
</head>`;

function buildReportHtml(options: ResultReportPrintOptions): string {
  const { records, entity, facility, period, safeCount, unsafeCount, passRate } = options;
  const generatedAt = formatReportDate(new Date());
  const total = records.length;

  const rowsHtml = records.map((r, idx) => {
    const isPass = r.status === 'PASS';
    const entity = r.equipment?.entity ?? '';
    const facility = r.equipment?.facility ?? '';
    const photos = (r.photo_url || '').split(',').map((p) => p.trim()).filter(Boolean);
    const typeColor = getTypeBadgeStyle(r.equipment_type);

    const photoHtml = photos.length > 0
      ? `<div class="photo-cell"><img src="${escapeHtml(photos[0])}" /></div>`
      : `<div class="photo-empty">NO<br/>PHOTO</div>`;

    const statusHtml = isPass
      ? `<span class="status-pass">&#10004; PASS</span>`
      : `<span class="status-fail">&#9888; NEEDS<br/>ATTENTION</span>`;

    return `<tr>
      <td class="dim">${idx + 1}</td>
      <td>${photoHtml}</td>
      <td class="id-cell">${escapeHtml(r.equipment_no_id)}</td>
      <td><span class="type-chip" style="background:${typeColor}">${escapeHtml(r.equipment_type)}</span></td>
      <td>${entity ? escapeHtml(entity) : '<span class="dim">—</span>'}<br/><span class="dim">${facility ? escapeHtml(facility) : '—'}</span></td>
      <td>${escapeHtml(r.inspection_date)}<br/><span class="dim">${escapeHtml(r.week)} (${escapeHtml(r.month_year)})</span></td>
      <td>${escapeHtml(r.inspector_name)}</td>
      <td>${statusHtml}</td>
      <td class="remarks-cell">${r.remarks ? escapeHtml(r.remarks) : '<span class="dim">—</span>'}</td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Inspection Result Report</title>
${PAGE_STYLES}
<body>
  <div class="page">
    <div class="report-header no-break">
      <div class="report-logo">
        <img src="/logoyj.jpeg" alt="Logo YJ" />
      </div>
      <div class="report-title-block">
        <div class="report-company">PT YONGJIN JAVASUKA GARMENT</div>
        <div class="report-title">Inspection Result Report</div>
        <div class="report-subtitle">Fire Protection Equipment Inspection — Summary of Inspection Results</div>
      </div>
      <div class="report-docno">
        <div class="docno-label">Document No.</div>
        <div class="docno-value">YJ-F.HSE.0038</div>
        <div class="docno-row">Issued: <b>${generatedAt}</b></div>
        <div class="docno-row">Revision: <b>00</b></div>
      </div>
    </div>

    <div class="meta-strip no-break">
      <div class="meta-box sky">
        <div class="meta-label">Entity</div>
        <div class="meta-value">${escapeHtml(entity)}</div>
      </div>
      <div class="meta-box sky">
        <div class="meta-label">Facility</div>
        <div class="meta-value">${escapeHtml(facility)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Period</div>
        <div class="meta-value">${escapeHtml(period)}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Total Inspected</div>
        <div class="meta-value">${total} Equipment</div>
      </div>
      <div class="meta-box green">
        <div class="meta-label">Pass (Safe)</div>
        <div class="meta-value">${safeCount} Items</div>
      </div>
      <div class="meta-box accent">
        <div class="meta-label">Needs Attention</div>
        <div class="meta-value">${unsafeCount} Items</div>
      </div>
      <div class="meta-box amber">
        <div class="meta-label">Health Score</div>
        <div class="meta-value">${passRate}%</div>
      </div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th style="width:22px">#</th>
          <th>Photo</th>
          <th>Equipment ID</th>
          <th>Type</th>
          <th>Entity / Facility</th>
          <th>Date / Period</th>
          <th>Inspector</th>
          <th>Status</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
${rowsHtml}
      </tbody>
    </table>

    <div class="report-footer">
      <div class="note">
        This report was generated from the fire protection inspection system.
        All equipment inspections follow the applicable fire safety checklist (HSE) and
        visual condition standards. Results marked NEEDS ATTENTION require follow-up action.
      </div>
      <div class="signature-block">
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <b>Prepared &amp; Approved By</b>
        <div>Safety Officer / HSE Dept.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function printResultReport(options: ResultReportPrintOptions): Promise<void> {
  if (options.records.length === 0) return;

  const html = absolutizePaths(buildReportHtml(options)).replace(
    '</body>',
    `<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 500);
  });
</script>
</body>`
  );

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }

  printWindow.document.write(html);
  printWindow.document.close();
}
