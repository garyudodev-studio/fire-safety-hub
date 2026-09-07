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
  // Exit Lamp status from latest inspection (for Emergency Lamp equipment)
  exit_lamp_status?: string;
}

export interface MasterlistPrintOptions {
  records: MasterlistPrintEquipment[];
  entity: string;
  facility: string;
  preparedBy?: string;
  preparedByTitle?: string;
  signatureUrl?: string | null;
  // If true, show Exit Lamp column instead of Details for Emergency Lamp equipment
  showExitLampColumn?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function formatDateIndo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
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
    border-collapse: separate;
    border-spacing: 0;
    margin-top: 12px;
    font-size: 9px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
  }
  table.report-table thead th {
    background: linear-gradient(135deg, #0d1526 0%, #1f3461 100%);
    color: #ffffff;
    padding: 9px 8px;
    text-align: left;
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-bottom: 2px solid #e6463c;
    border-right: 1px solid rgba(255,255,255,0.12);
    position: relative;
  }
  table.report-table thead th:last-child { border-right: none; }
  table.report-table thead th::after {
    content: "";
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 2px;
    background: linear-gradient(90deg, #e6463c, #f59e0b, #fbbf24);
  }
  table.report-table tbody td {
    padding: 7px 8px;
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #f1f5f9;
    vertical-align: middle;
    color: #1f2937;
  }
  table.report-table tbody td:last-child { border-right: none; }
  table.report-table tbody tr:nth-child(even) { background: #f8fafc; }
  table.report-table tbody tr:nth-child(odd) { background: #ffffff; }
  table.report-table tbody tr:hover { background: #fff7ed; }
  table.report-table tbody tr:last-child td { border-bottom: none; }
  table.report-table tbody tr { page-break-inside: avoid; transition: background 0.15s ease; }
  table.report-table thead { display: table-header-group; }

  .row-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #e0e7ef;
    color: #475569;
    font-weight: 800;
    font-size: 9px;
    font-family: "Courier New", monospace;
  }
  .id-cell {
    font-weight: 800;
    color: #0f172a;
    font-family: "Courier New", monospace;
    font-size: 10.5px;
    letter-spacing: 0.02em;
  }
  .id-cell .id-badge {
    display: inline-block;
    padding: 3px 8px;
    background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    box-shadow: inset 0 -1px 0 rgba(0,0,0,0.04);
  }
  .dim { color: #64748b; font-size: 8px; }
  .muted-text { color: #94a3b8; font-size: 8.5px; font-style: italic; }

  /* Location stack */
  .info-stack { line-height: 1.45; }
  .info-stack .primary { font-weight: 700; color: #0f172a; font-size: 9.5px; }
  .info-stack .secondary { color: #64748b; font-size: 8px; margin-top: 1px; }

  /* Details cell — visual chips */
  .details-cell { max-width: 170px; }
  .detail-chips { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 7.5px;
    font-weight: 600;
    line-height: 1.3;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .chip.neutral { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }
  .chip.info    { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  .chip.warn    { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  .chip.danger  { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  .chip.success { background: #ecfdf5; color: #047857; border-color: #bbf7d0; }
  .chip.gray    { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }
  .chip .chip-icon {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 50%;
  }
  .chip .chip-icon.sky   { background: #0284c7; }
  .chip .chip-icon.ember { background: #dc2626; }
  .chip .chip-icon.amber { background: #f59e0b; }
  .chip .chip-icon.gray  { background: #94a3b8; }

  /* Type chip (left column) */
  .type-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: 14px;
    font-size: 8px;
    font-weight: 800;
    color: #ffffff;
    white-space: nowrap;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }
  .type-chip .dot {
    width: 5px; height: 5px;
    background: rgba(255,255,255,0.85);
    border-radius: 50%;
    box-shadow: 0 0 0 1.5px rgba(255,255,255,0.3);
  }

  /* PIC mini-card */
  .pic-mini {
    display: flex;
    align-items: center;
    gap: 5px;
    line-height: 1.2;
  }
  .pic-mini .pic-avatar {
    width: 20px; height: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0d1526, #1f3461);
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 800;
    flex-shrink: 0;
    border: 1px solid #cbd5e1;
  }
  .pic-mini .pic-name { font-weight: 700; color: #0f172a; font-size: 9px; }
  .pic-mini .pic-role {
    font-size: 7px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Exit lamp symbol */
  .exit-lamp-symbol {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px; height: 26px;
    border-radius: 50%;
    font-size: 14px;
    font-weight: 800;
  }
  .exit-lamp-symbol.installed {
    background: #ecfdf5; color: #047857;
    border: 1.5px solid #bbf7d0;
  }
  .exit-lamp-symbol.not-installed {
    background: #fef2f2; color: #b91c1c;
    border: 1.5px solid #fecaca;
  }
  .exit-lamp-symbol.not-working {
    background: #fffbeb; color: #b45309;
    border: 1.5px solid #fde68a;
  }

  /* Highlight expired rows */
  tr.row-expired {
    background: linear-gradient(90deg, #fef2f2 0%, #ffffff 70%) !important;
  }
  tr.row-expired:nth-child(even) {
    background: linear-gradient(90deg, #fee2e2 0%, #f8fafc 70%) !important;
  }
  tr.row-expired .id-cell .id-badge {
    background: #fef2f2;
    border-color: #fca5a5;
    color: #991b1b;
  }
  tr.row-warning {
    background: linear-gradient(90deg, #fffbeb 0%, #ffffff 70%) !important;
  }
  tr.row-warning:nth-child(even) {
    background: linear-gradient(90deg, #fef3c7 0%, #f8fafc 70%) !important;
  }

  /* Legend strip */
  .legend-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 10px;
    padding: 7px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 8px;
    color: #475569;
  }
  .legend-strip .legend-title {
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #64748b;
    margin-right: 4px;
  }
  .legend-strip .legend-item { display: inline-flex; align-items: center; gap: 4px; }

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
  const { records, entity, facility, preparedBy, preparedByTitle, signatureUrl, showExitLampColumn } = options;
  const total = records.length;
  const isEmergencyLampFilter = showExitLampColumn === true;

  const typeCounts = new Map<string, number>();
  records.forEach((r) => typeCounts.set(r.type, (typeCounts.get(r.type) || 0) + 1));
  const breakdownHtml = Array.from(typeCounts.keys())
    .map((t) => `<span class="type-chip" style="background:${getTypeBadgeStyle(t)}">${escapeHtml(t)}</span>`)
    .join('&nbsp; ');

  // Exit Lamp status symbols
  const getExitLampSymbol = (status?: string) => {
    if (!status) return '<span class="dim">—</span>';
    switch (status) {
      case 'Installed':
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <span class="exit-lamp-symbol installed">✓</span>
          <span style="font-size:7.5px;color:#047857;font-weight:700;">Installed</span>
        </div>`;
      case 'Not Installed':
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <span class="exit-lamp-symbol not-installed">✗</span>
          <span style="font-size:7.5px;color:#b91c1c;font-weight:700;">Not Installed</span>
        </div>`;
      default:
        return `<span class="dim">${escapeHtml(status)}</span>`;
    }
  };

  const rowsHtml = records.map((r, idx) => {
    const typeColor = getTypeBadgeStyle(r.type);
    const isEmergencyLamp = r.type === 'Emergency Lamp';

    // Build chips for details
    const chips: string[] = [];
    if (r.zone) chips.push(`<span class="chip info"><span class="chip-icon sky"></span>${escapeHtml(r.zone)}</span>`);
    if (r.placement) chips.push(`<span class="chip neutral">${escapeHtml(r.placement)}</span>`);
    if (r.extinguisher_type) chips.push(`<span class="chip neutral">${escapeHtml(r.extinguisher_type)}</span>`);
    if (r.weight_kg) chips.push(`<span class="chip gray">${escapeHtml(String(r.weight_kg))} kg</span>`);

    let rowClass = '';
    let expireChip = '';
    if (r.expire_date) {
      const exp = new Date(r.expire_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      exp.setHours(0, 0, 0, 0);
      const days = Math.round((exp.getTime() - today.getTime()) / 86400000);
      const formatted = formatDateIndo(r.expire_date);
      if (days < 0) {
        expireChip = `<span class="chip danger"><span class="chip-icon ember"></span>Expired ${Math.abs(days)}d</span>`;
        rowClass = 'row-expired';
      } else if (days <= 30) {
        expireChip = `<span class="chip warn"><span class="chip-icon amber"></span>${days}d left</span>`;
        if (!rowClass) rowClass = 'row-warning';
      } else {
        expireChip = `<span class="chip success"><span class="chip-icon gray"></span>${formatted}</span>`;
      }
      chips.push(expireChip);
    }
    if (r.start_date) {
      chips.push(`<span class="chip gray" title="Start Date">${formatDateIndo(r.start_date)}</span>`);
    }

    const detailsHtml = chips.length > 0
      ? `<div class="detail-chips">${chips.join('')}</div>`
      : '<span class="muted-text">— no details —</span>';

    const exitLampCell = isEmergencyLamp && isEmergencyLampFilter
      ? getExitLampSymbol(r.exit_lamp_status)
      : detailsHtml;

    // PIC mini card
    const renderPic = (pic?: { name?: string | null } | null, slotLabel?: string) => {
      if (!pic?.name) return `<span class="muted-text">— ${slotLabel || ''}</span>`;
      const initial = String(pic.name).charAt(0).toUpperCase();
      return `<div class="pic-mini">
        <span class="pic-avatar">${escapeHtml(initial)}</span>
        <div>
          <div class="pic-name">${escapeHtml(pic.name)}</div>
          ${slotLabel ? `<div class="pic-role">${escapeHtml(slotLabel)}</div>` : ''}
        </div>
      </div>`;
    };

    // Area & location stack
    const renderLocStack = (primary?: string | null, secondary?: string | null, secLabel = '') => {
      if (!primary && !secondary) return '<span class="muted-text">—</span>';
      return `<div class="info-stack">
        ${primary ? `<div class="primary">${escapeHtml(primary)}</div>` : ''}
        ${secondary ? `<div class="secondary">${secLabel ? escapeHtml(secLabel) + ': ' : ''}${escapeHtml(secondary)}</div>` : ''}
      </div>`;
    };

    return `<tr class="${rowClass}">
      <td style="text-align:center;"><span class="row-num">${idx + 1}</span></td>
      <td class="id-cell"><span class="id-badge">${escapeHtml(r.no_id || '—')}</span></td>
      <td><span class="type-chip" style="background:${typeColor}"><span class="dot"></span>${escapeHtml(r.type)}</span></td>
      <td>${r.entity ? `<strong>${escapeHtml(r.entity)}</strong>` : '<span class="muted-text">—</span>'}</td>
      <td>${r.facility ? escapeHtml(r.facility) : '<span class="muted-text">—</span>'}</td>
      <td>${renderLocStack(r.area, null)}</td>
      <td>${renderLocStack(r.location, r.zone, 'Zone')}</td>
      <td class="details-cell">${exitLampCell}</td>
      <td>${renderPic(r.pic_1, 'PIC Fire Expert')}</td>
      <td>${renderPic(r.pic_2, 'PIC Area')}</td>
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
      <div class="report-docno">
        <div class="docno-label">Document No.</div>
        <div class="docno-value">FSM-${escapeHtml(new Date().toISOString().slice(0,10).replace(/-/g,''))}</div>
        <div class="docno-row">Issued: <b>${escapeHtml(formatDateIndo(new Date().toISOString()))}</b></div>
        <div class="docno-row">Total: <b>${total} Items</b></div>
        ${isEmergencyLampFilter ? '<div class="docno-row" style="color:#f59e0b;font-weight:800;">⏰ Exit Lamp Mode</div>' : ''}
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
          <th style="width:32px">No.</th>
          <th>Equipment ID</th>
          <th>Type</th>
          <th>Entity</th>
          <th>Facility</th>
          <th>Area</th>
          <th>Location / Zone</th>
          <th>${isEmergencyLampFilter ? 'Exit Lamp Status' : 'Details &amp; Expiry'}</th>
          <th>PIC Fire Expert</th>
          <th>PIC Area</th>
        </tr>
      </thead>
      <tbody>
${rowsHtml}
      </tbody>
    </table>

    ${!isEmergencyLampFilter ? `
    <div class="legend-strip">
      <span class="legend-title">Legend</span>
      <span class="legend-item"><span class="chip info"><span class="chip-icon sky"></span>Zone</span> Zone identifier</span>
      <span class="legend-item"><span class="chip neutral">Placement</span> Mounting placement</span>
      <span class="legend-item"><span class="chip gray">Weight</span> Extinguisher weight</span>
      <span class="legend-item"><span class="chip success"><span class="chip-icon gray"></span>Valid</span> More than 30 days remaining</span>
      <span class="legend-item"><span class="chip warn"><span class="chip-icon amber"></span>Soon</span> Expiring within 30 days</span>
      <span class="legend-item"><span class="chip danger"><span class="chip-icon ember"></span>Expired</span> Past expiry date — replace now</span>
    </div>
    ` : `
    <div class="legend-strip">
      <span class="legend-title">Legend</span>
      <span class="legend-item"><span class="exit-lamp-symbol installed" style="width:18px;height:18px;font-size:11px;">✓</span> Exit lamp installed &amp; working</span>
      <span class="legend-item"><span class="exit-lamp-symbol not-installed" style="width:18px;height:18px;font-size:11px;">✗</span> Exit lamp not installed</span>
      <span class="legend-item"><span class="exit-lamp-symbol not-working" style="width:18px;height:18px;font-size:11px;">⚠</span> Exit lamp installed but not working</span>
    </div>
    `}

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
        <b>${preparedBy ? escapeHtml(preparedBy) : 'Prepared & Approved By'}</b>
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