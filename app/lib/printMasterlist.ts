// ─── Types ───────────────────────────────────────────────────────────────────

export interface MasterlistPrintEquipment {
  id: string;
  no_id: string | null;
  type: string;
  entity?: string | null;
  facility?: string | null;
  area?: string | null;
  location?: string | null;
  zone?: string | null;
  placement?: string | null;
  extinguisher_type?: string | null;
  weight_kg?: string | null;
  start_date?: string | null;
  expire_date?: string | null;
  pic_1?: { id?: string; name?: string | null } | null;
  pic_2?: { id?: string; name?: string | null } | null;
}

export interface MasterlistPrintOptions {
  records: MasterlistPrintEquipment[];
  entity: string;
  facility: string;
  preparedBy?: string;
  preparedByTitle?: string;
  signatureUrl?: string | null;
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
      content: "PT YONGJIN JAVASUKA GARMENT — Fire Safety Masterlist";
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
  .meta-box.sky { border-left-color: #0284c7; background: #f0f9ff; }
  .meta-box.sky .meta-value { color: #0369a1; }
  .meta-box.ember { border-left-color: #dc2626; background: #fef2f2; }
  .meta-box.ember .meta-value { color: #b91c1c; }

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
  .id-cell { font-weight: 700; color: #0f172a; font-family: "Courier New", monospace; font-size: 10px; }
  .dim { color: #64748b; font-size: 8px; }
  .details-cell { max-width: 150px; word-break: break-word; }
  .type-chip {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 8px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
  }
  .expiry-soon { color: #b45309; font-weight: 700; }
  .expiry-expired { color: #b91c1c; font-weight: 700; }

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
  .signature-block .sig-img { height: 54px; display: flex; align-items: center; justify-content: center; }
  .signature-block .sig-img img { max-height: 54px; max-width: 160px; object-fit: contain; display: block; }

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

function buildMasterlistHtml(options: MasterlistPrintOptions): string {
  const { records, entity, facility, preparedBy, preparedByTitle, signatureUrl } = options;
  const total = records.length;

  const typeCounts = new Map<string, number>();
  records.forEach((r) => typeCounts.set(r.type, (typeCounts.get(r.type) || 0) + 1));
  const breakdownHtml = Array.from(typeCounts.keys())
    .map((t) => `<span class="type-chip" style="background:${getTypeBadgeStyle(t)}">${escapeHtml(t)}</span>`)
    .join('&nbsp; ');

  const rowsHtml = records.map((r, idx) => {
    const typeColor = getTypeBadgeStyle(r.type);

    const details: string[] = [];
    if (r.zone) details.push(`Zone: ${escapeHtml(r.zone)}`);
    if (r.placement) details.push(`Placement: ${escapeHtml(r.placement)}`);
    if (r.extinguisher_type) details.push(`Type: ${escapeHtml(r.extinguisher_type)}`);
    if (r.weight_kg) details.push(`Weight: ${escapeHtml(String(r.weight_kg))} kg`);
    if (r.start_date) details.push(`Start: ${escapeHtml(r.start_date)}`);
    if (r.expire_date) {
      const exp = new Date(r.expire_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      exp.setHours(0, 0, 0, 0);
      const days = Math.round((exp.getTime() - today.getTime()) / 86400000);
      const cls = days < 0 ? 'expiry-expired' : days <= 30 ? 'expiry-soon' : '';
      details.push(`Expire: <span class="${cls}">${escapeHtml(r.expire_date)}${days < 0 ? ' (expired)' : days <= 30 ? ` (${days}d left)` : ''}</span>`);
    }

    return `<tr>
      <td class="dim">${idx + 1}</td>
      <td class="id-cell">${escapeHtml(r.no_id || '')}</td>
      <td><span class="type-chip" style="background:${typeColor}">${escapeHtml(r.type)}</span></td>
      <td>${r.entity ? escapeHtml(r.entity) : '<span class="dim">—</span>'}</td>
      <td>${r.facility ? escapeHtml(r.facility) : '<span class="dim">—</span>'}</td>
      <td>${r.area ? escapeHtml(r.area) : '<span class="dim">—</span>'}</td>
      <td>${r.location ? escapeHtml(r.location) : '<span class="dim">—</span>'}</td>
      <td class="details-cell">${details.length > 0 ? details.join('<br/>') : '<span class="dim">—</span>'}</td>
      <td>${r.pic_1?.name ? escapeHtml(r.pic_1.name) : '<span class="dim">—</span>'}</td>
      <td>${r.pic_2?.name ? escapeHtml(r.pic_2.name) : '<span class="dim">—</span>'}</td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Fire Safety Masterlist</title>
${PAGE_STYLES}
<body>
  <div class="page">
    <div class="report-header no-break">
      <div class="report-logo">
        <img src="/logoyj.jpeg" alt="Logo YJ" />
      </div>
      <div class="report-title-block">
        <div class="report-company">PT YONGJIN JAVASUKA GARMENT</div>
        <div class="report-title">Fire Safety Masterlist</div>
        <div class="report-subtitle">Fire Protection Equipment Masterlist — Register of All Fire Safety Equipment</div>
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
      <div class="meta-box ember">
        <div class="meta-label">Total Equipment</div>
        <div class="meta-value">${total} Items</div>
      </div>
      <div class="meta-box" style="flex: 2 1 0;">
        <div class="meta-label">Type Equipment</div>
        <div class="meta-value" style="font-size:10px;line-height:1.7;">${breakdownHtml || '<span class="dim">No equipment</span>'}</div>
      </div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th style="width:22px">#</th>
          <th>Equipment ID</th>
          <th>Type</th>
          <th>Entity</th>
          <th>Facility</th>
          <th>Area</th>
          <th>Location</th>
          <th>Details</th>
          <th>PIC 1</th>
          <th>PIC 2</th>
        </tr>
      </thead>
      <tbody>
${rowsHtml}
      </tbody>
    </table>

    <div class="report-footer">
      <div class="note">
        This document is the official fire protection equipment masterlist of the facility.
        It lists all fire alarms, fire hydrants, fire extinguishers, and emergency lamps installed on site.
        Fire extinguishers marked <strong>expired</strong> or with a short remaining life must be serviced or replaced immediately.
        Any changes to the equipment register must be recorded and the masterlist re-issued.
      </div>
      <div class="signature-block">
        ${signatureUrl ? `<div class="sig-img"><img src="${escapeHtml(signatureUrl)}" alt="Signature" /></div>` : '<div class="sig-space"></div>'}
        <div class="sig-line"></div>
        <b>${preparedBy ? escapeHtml(preparedBy) : 'Prepared &amp; Approved By'}</b>
        <div>${preparedByTitle ? escapeHtml(preparedByTitle) : 'Safety Officer / HSE Dept.'}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function printMasterlist(options: MasterlistPrintOptions): Promise<void> {
  if (options.records.length === 0) return;

  const html = absolutizePaths(buildMasterlistHtml(options)).replace(
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