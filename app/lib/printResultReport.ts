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
  improvement?: {
    id?: string;
    issue_description?: string | null;
    action_plan?: string | null;
    action_taken?: string | null;
    pic_name?: string | null;
    target_date?: string | null;
    completion_date?: string | null;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | string;
    before_photo_url?: string | null;
    after_photo_url?: string | null;
  } | null;
}

export interface ResultReportPrintOptions {
  records: ReportPrintRecord[];
  entity: string;
  facility: string;
  period: string;
  safeCount: number;
  unsafeCount: number;
  resolvedCount?: number;
  inProgressCount?: number;
  openCount?: number;
  passRate: number;
  healthScore?: number;
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
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return html.replace(/(src|href)="\/(?!\/)/g, `$1="${origin}/`);
}

// ─── Build HTML ──────────────────────────────────────────────────────────────

const PAGE_STYLES = `
<style>
  @page {
    size: A4 landscape;
    margin: 8mm 9mm 10mm;
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 8px;
      color: #94a3b8;
      font-family: Arial, sans-serif;
    }
    @bottom-left {
      content: "PT YONGJIN JAVASUKA GARMENT — Inspection & CAPA Result Report";
      font-size: 8px;
      color: #94a3b8;
      font-family: Arial, sans-serif;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; }
  body { background: #e5e7eb; padding: 20px; }

  .page {
    background: #ffffff;
    width: 279mm;
    min-height: 190mm;
    margin: 0 auto;
    padding: 9mm 10mm;
    box-shadow: 0 12px 40px rgba(15, 23, 42, 0.22);
    border-radius: 6px;
  }
  .no-break { page-break-inside: avoid; }

  /* ══ Header — dark navy gradient + ember accent ══ */
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
    font-size: 21px;
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
    gap: 7px;
    margin-top: 10px;
  }
  .meta-box {
    flex: 1 1 0;
    min-width: 105px;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #94a3b8;
    border-radius: 8px;
    padding: 6px 9px;
    background: #f8fafc;
  }
  .meta-box .meta-label {
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #64748b;
    text-transform: uppercase;
  }
  .meta-box .meta-value {
    font-size: 11.5px;
    font-weight: 700;
    color: #0f172a;
    margin-top: 2px;
  }
  .meta-box.accent { border-left-color: #e11d48; background: #fff1f2; }
  .meta-box.accent .meta-value { color: #be123c; }
  .meta-box.green { border-left-color: #16a34a; background: #f0fdf4; }
  .meta-box.green .meta-value { color: #15803d; }
  .meta-box.amber { border-left-color: #d97706; background: #fffbeb; }
  .meta-box.amber .meta-value { color: #b45309; }
  .meta-box.sky { border-left-color: #0284c7; background: #f0f9ff; }
  .meta-box.sky .meta-value { color: #0369a1; }
  .meta-box.emerald { border-left-color: #059669; background: #ecfdf5; }
  .meta-box.emerald .meta-value { color: #047857; }

  /* ── Table ── */
  table.report-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 8.5px;
  }
  table.report-table thead th {
    background: linear-gradient(90deg, #16233f, #1f3461);
    color: #ffffff;
    padding: 6px 7px;
    text-align: left;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border: 1px solid #16233f;
  }
  table.report-table tbody td {
    padding: 5px 7px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
    color: #374151;
  }
  table.report-table tbody tr:nth-child(even) { background: #f8fafc; }
  table.report-table tbody tr { page-break-inside: avoid; }
  table.report-table thead { display: table-header-group; }

  /* Photos */
  .photos-container {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .photo-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .photo-box img {
    width: 44px;
    height: 34px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
    display: block;
    background: #f1f5f9;
  }
  .photo-tag {
    font-size: 6.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 3px;
    border-radius: 2px;
  }
  .photo-tag.before { background: #fee2e2; color: #b91c1c; }
  .photo-tag.after  { background: #dcfce7; color: #15803d; }
  .photo-empty {
    width: 44px;
    height: 34px;
    border-radius: 4px;
    border: 1px dashed #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 6.5px;
    text-align: center;
    line-height: 1.1;
    background: #f8fafc;
  }

  /* Status Badges */
  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    white-space: nowrap;
    text-align: center;
  }
  .status-pass {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #86efac;
  }
  .status-resolved {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #6ee7b7;
  }
  .status-in-progress {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }
  .status-open {
    background: #fff1f2;
    color: #be123c;
    border: 1px solid #fecdd3;
  }

  .type-chip {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 7.5px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
  }
  .id-cell { font-weight: 700; color: #0f172a; font-family: "Courier New", monospace; font-size: 9.5px; }
  .dim { color: #64748b; font-size: 7.5px; }
  
  /* Remarks and CAPA block */
  .remarks-block { font-size: 8px; line-height: 1.35; color: #334155; }
  .capa-box {
    margin-top: 4px;
    padding: 4px 6px;
    border-radius: 4px;
    background: #f1f5f9;
    border-left: 3px solid #0284c7;
    font-size: 7.5px;
    line-height: 1.3;
  }
  .capa-box.resolved {
    background: #f0fdf4;
    border-left-color: #10b981;
  }
  .capa-box.in-progress {
    background: #fffbeb;
    border-left-color: #f59e0b;
  }
  .capa-box.open {
    background: #fff1f2;
    border-left-color: #f43f5e;
  }
  .capa-box .capa-header {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .capa-box.resolved .capa-header { color: #047857; }
  .capa-box.in-progress .capa-header { color: #b45309; }
  .capa-box.open .capa-header { color: #be123c; }

  /* ── Footer ── */
  .report-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #cbd5e1;
  }
  .report-footer .note { font-size: 7.5px; color: #64748b; max-width: 50%; line-height: 1.4; }
  .signatures-wrap {
    display: flex;
    gap: 24px;
  }
  .signature-block { text-align: center; font-size: 8px; color: #475569; flex-shrink: 0; min-width: 130px; }
  .signature-block .sig-space { height: 44px; }
  .signature-block .sig-line { border-bottom: 1px solid #475569; width: 130px; margin: 0 auto 3px; }
  .signature-block b { font-size: 9px; color: #0f172a; display: block; }

  @media print {
    @page {
      margin: 8mm 9mm 10mm;
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
  const {
    records,
    entity,
    facility,
    period,
    safeCount,
    unsafeCount,
    resolvedCount = 0,
    inProgressCount = 0,
    openCount = 0,
    passRate,
    healthScore = passRate,
  } = options;

  const generatedAt = formatReportDate(new Date());
  const total = records.length;

  const rowsHtml = records.map((r, idx) => {
    const isPass = r.status === 'PASS';
    const eqEntity = r.equipment?.entity ?? '';
    const eqFacility = r.equipment?.facility ?? '';
    const eqLocation = [r.equipment?.area, r.equipment?.location].filter(Boolean).join(' · ');
    const typeColor = getTypeBadgeStyle(r.equipment_type);

    const photos = (r.photo_url || '').split(',').map((p) => p.trim()).filter(Boolean);
    const beforePhoto = photos.length > 0 ? photos[0] : (r.improvement?.before_photo_url || null);
    const afterPhoto = r.improvement?.after_photo_url || null;

    // Photos HTML (Before / After)
    let photoHtml = '';
    if (beforePhoto || afterPhoto) {
      photoHtml = `<div class="photos-container">`;
      if (beforePhoto) {
        photoHtml += `<div class="photo-box"><img src="${escapeHtml(beforePhoto)}" />${afterPhoto ? '<span class="photo-tag before">Before</span>' : ''}</div>`;
      }
      if (afterPhoto) {
        photoHtml += `<div class="photo-box"><img src="${escapeHtml(afterPhoto)}" /><span class="photo-tag after">Fixed</span></div>`;
      }
      photoHtml += `</div>`;
    } else {
      photoHtml = `<div class="photo-empty">NO<br/>PHOTO</div>`;
    }

    // Status Badge & CAPA details
    const imp = r.improvement;
    let statusHtml = '';
    let capaBlock = '';

    if (isPass) {
      statusHtml = `<span class="badge status-pass">&#10004; PASS</span>`;
    } else {
      const impStatus = imp?.status || 'OPEN';
      if (impStatus === 'RESOLVED') {
        statusHtml = `<span class="badge status-resolved">&#10004; RESOLVED (CAPA)</span>`;
      } else if (impStatus === 'IN_PROGRESS') {
        statusHtml = `<span class="badge status-in-progress">&#9203; IN PROGRESS (CAPA)</span>`;
      } else {
        statusHtml = `<span class="badge status-open">&#9888; OPEN (Needs Action)</span>`;
      }

      // Build structured CAPA info box
      const actionText = imp?.action_taken || imp?.action_plan || r.action_taken || '';
      const picText = imp?.pic_name || '';
      const dateText = imp?.completion_date ? `Completed: ${imp.completion_date}` : imp?.target_date ? `Target: ${imp.target_date}` : '';
      const themeClass = impStatus === 'RESOLVED' ? 'resolved' : impStatus === 'IN_PROGRESS' ? 'in-progress' : 'open';

      if (actionText || picText || dateText) {
        capaBlock = `
          <div class="capa-box ${themeClass}">
            <div class="capa-header">
              <span>CAPA Follow-up [${escapeHtml(impStatus)}]</span>
              ${dateText ? `<span>${escapeHtml(dateText)}</span>` : ''}
            </div>
            ${actionText ? `<div><b>Action:</b> ${escapeHtml(actionText)}</div>` : ''}
            ${picText ? `<div><b>PIC:</b> ${escapeHtml(picText)}</div>` : ''}
          </div>
        `;
      }
    }

    const remarksText = r.remarks ? escapeHtml(r.remarks) : (isPass ? '<span class="dim">Normal condition</span>' : '<span class="dim">No defect remarks</span>');

    return `<tr>
      <td class="dim" style="width:20px; text-align:center">${idx + 1}</td>
      <td style="width:95px">${photoHtml}</td>
      <td class="id-cell" style="width:85px">${escapeHtml(r.equipment_no_id)}</td>
      <td style="width:95px"><span class="type-chip" style="background:${typeColor}">${escapeHtml(r.equipment_type)}</span></td>
      <td style="width:115px">
        <b>${eqEntity ? escapeHtml(eqEntity) : '—'}</b><br/>
        <span class="dim">${eqFacility ? escapeHtml(eqFacility) : '—'}</span>
        ${eqLocation ? `<div class="dim" style="margin-top:2px">${escapeHtml(eqLocation)}</div>` : ''}
      </td>
      <td style="width:95px">
        <b>${escapeHtml(r.inspection_date)}</b><br/>
        <span class="dim">${escapeHtml(r.week)} (${escapeHtml(r.month_year)})</span>
      </td>
      <td style="width:80px">${escapeHtml(r.inspector_name)}</td>
      <td style="width:105px; text-align:center">${statusHtml}</td>
      <td>
        <div class="remarks-block">${remarksText}</div>
        ${capaBlock}
      </td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Inspection &amp; CAPA Result Report</title>
${PAGE_STYLES}
<body>
  <div class="page">
    <div class="report-header no-break">
      <div class="report-logo">
        <img src="/logoyj.jpeg" alt="Logo YJ" />
      </div>
      <div class="report-title-block">
        <div class="report-company">PT YONGJIN JAVASUKA GARMENT</div>
        <div class="report-title">Inspection &amp; CAPA Result Report</div>
        <div class="report-subtitle">Fire Protection Equipment Inspection — Summary of Inspection Results &amp; Corrective Actions (CAPA)</div>
      </div>
      <div class="report-docno">
        <div class="docno-label">Document No.</div>
        <div class="docno-value">YJ-F.HSE.0038</div>
        <div class="docno-row">Issued: <b>${generatedAt}</b></div>
        <div class="docno-row">Revision: <b>01 (CAPA)</b></div>
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
        <div class="meta-value">${total} Items</div>
      </div>
      <div class="meta-box green">
        <div class="meta-label">Pass (Safe)</div>
        <div class="meta-value">${safeCount} Items</div>
      </div>
      <div class="meta-box emerald">
        <div class="meta-label">CAPA Resolved</div>
        <div class="meta-value">${resolvedCount} Fixed</div>
      </div>
      <div class="meta-box amber">
        <div class="meta-label">CAPA In Progress</div>
        <div class="meta-value">${inProgressCount} Ongoing</div>
      </div>
      <div class="meta-box accent">
        <div class="meta-label">Needs Action (Open)</div>
        <div class="meta-value">${openCount} Open</div>
      </div>
      <div class="meta-box emerald">
        <div class="meta-label">Health Score</div>
        <div class="meta-value">${healthScore}%</div>
      </div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th style="width:20px; text-align:center">#</th>
          <th style="width:95px">Photo</th>
          <th style="width:85px">Equipment ID</th>
          <th style="width:95px">Type</th>
          <th style="width:115px">Location</th>
          <th style="width:95px">Date / Period</th>
          <th style="width:80px">Inspector</th>
          <th style="width:105px; text-align:center">Status / CAPA</th>
          <th>Findings &amp; Corrective Actions</th>
        </tr>
      </thead>
      <tbody>
${rowsHtml}
      </tbody>
    </table>

    <div class="report-footer">
      <div class="note">
        This report is generated from the Fire Protection Inspection &amp; Safety Hub. All equipment inspections follow HSE standards and regulatory compliance requirements. Corrective and Preventive Actions (CAPA) are logged, verified, and monitored until closure.
      </div>
      <div class="signatures-wrap">
        <div class="signature-block">
          <div class="sig-space"></div>
          <div class="sig-line"></div>
          <b>Inspector / Safety Officer</b>
          <div>Prepared By (HSE)</div>
        </div>
        <div class="signature-block">
          <div class="sig-space"></div>
          <div class="sig-line"></div>
          <b>HSE Head / Factory Head</b>
          <div>Approved &amp; Acknowledged By</div>
        </div>
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
