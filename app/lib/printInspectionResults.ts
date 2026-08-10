import { getChecklistForType } from './inspectionChecklists';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PrintPic {
  name?: string | null;
  phone?: string | null;
  image_profile?: string | null;
  image_contact?: string | null;
}

export interface PrintInspectionEquipment {
  area?: string | null;
  location?: string | null;
  pic_1?: PrintPic | null;
  pic_2?: PrintPic | null;
}

export interface PrintInspectionRecord {
  id: string;
  equipment_id: string;
  equipment_no_id: string;
  equipment_type: string;
  inspector_name: string;
  inspection_date: string;
  week: string;
  month_year: string;
  answers: Record<string, 'YES' | 'NO' | 'NA'>;
  status?: string;
  remarks?: string | null;
  action_taken?: string | null;
  equipment?: PrintInspectionEquipment | null;
}

// ─── Template resolution ────────────────────────────────────────────────────

function getFormTemplate(type: string): string {
  switch (type) {
    case 'Fire Alarm': return '/form_checklist/form checklist_fire alarm.html';
    case 'Fire Hydrant': return '/form_checklist/form checklist_fire hydrant.html';
    case 'Fire Extinguisher': return '/form_checklist/form checklist_fire extinguishers.html';
    case 'Emergency Lamp': return '/form_checklist/form checklist_emergency lamp.html';
    default: return '/form_checklist/form checklist_fire alarm.html';
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Appends `value` right after the last colon inside a cell's innerHTML.
 * Template cells are built as `<span>...Label</span> ... :` so this fills the
 * blank value slot that follows the trailing colon.
 */
function appendAfterColon(innerHTML: string, value: string): string {
  const idx = innerHTML.lastIndexOf(':');
  const safe = escapeHtml(value);
  if (idx === -1) return `${innerHTML} : ${safe}`;
  return `${innerHTML.slice(0, idx + 1)} ${safe}`;
}

function setAnswerCell(cell: Element, content: string, color: string) {
  cell.textContent = content;
  const el = cell as HTMLElement;
  el.style.color = color;
  el.style.fontWeight = 'bold';
  el.style.textAlign = 'center';
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Converts a "MM/YYYY" value (as stored on inspection records) into a
 * "Bulan Tahun" label, e.g. "08/2026" -> "Agustus 2026".
 */
function formatMonthYearLabel(monthYear: string): string {
  const [mm, yyyy] = monthYear.split('/');
  const monthNum = parseInt(mm, 10);
  if (!mm || isNaN(monthNum) || monthNum < 1 || monthNum > 12) return monthYear;
  const year = parseInt(yyyy, 10);
  return `${INDONESIAN_MONTHS[monthNum - 1]} ${isNaN(year) ? yyyy : year}`;
}

/**
 * Some templates reference root-relative assets (e.g. `/logoyj.jpeg`).
 * A `window.open('', '_blank')` document has no meaningful base URL, so we
 * rewrite them to absolute URLs against the current origin.
 */
function absolutizePaths(html: string): string {
  const origin = window.location.origin;
  return html.replace(/(src|href)="\/(?!\/)/g, `$1="${origin}/`);
}

// ─── Page builder ────────────────────────────────────────────────────────────

function fillInspectionPage(
  container: Element,
  insp: PrintInspectionRecord,
  signatures: Record<string, string | null>
) {
  const equipment = insp.equipment;
  const monthYear = insp.month_year || '';
  const week = insp.week || '';
  const date = insp.inspection_date || '';

  // ── Identity info table: ID / AREA / LOCATION / Month-Year / Week ──
  let weekFilled = false;
  container.querySelectorAll('.info-table td').forEach((cell) => {
    const el = cell as HTMLElement;
    const txt = el.textContent || '';
    const trimmed = txt.trim();

    if (/^(ALARM|APAR|HYDRANT|LIGHT)\s+ID$/.test(trimmed)) {
      const next = el.nextElementSibling;
      if (next) next.textContent = `: ${insp.equipment_no_id}`;
    } else if (trimmed === 'AREA') {
      const next = el.nextElementSibling;
      if (next) next.textContent = `: ${equipment?.area || ''}`;
    } else if (trimmed === 'LOCATION') {
      const next = el.nextElementSibling;
      if (next) next.textContent = `: ${equipment?.location || ''}`;
    } else if (/Month\s*\/\s*Year/.test(txt)) {
      el.innerHTML = appendAfterColon(el.innerHTML, formatMonthYearLabel(monthYear));
    } else if (/Week/.test(txt) && !weekFilled) {
      el.innerHTML = appendAfterColon(el.innerHTML, week);
      weekFilled = true;
    }
  });

  const checklistTable = container.querySelector('.checklist-table');
  if (!checklistTable) return;

  // ── Date column in checklist header (fill the first one only) ──
  let dateFilled = false;
  checklistTable.querySelectorAll('td').forEach((cell) => {
    if (dateFilled) return;
    const el = cell as HTMLElement;
    if (/Date/.test(el.textContent || '')) {
      el.innerHTML = appendAfterColon(el.innerHTML, date);
      dateFilled = true;
    }
  });

  // ── Mark checklist answers ──
  // The template data rows (the ones with 6 cells) are ordered exactly like the
  // checklist definitions, so we walk them sequentially and consume answers in
  // order. This is robust against typo differences between template text and
  // the definition labels (e.g. "DETECTORE" vs "DETECTOR").
  const checklist = getChecklistForType(insp.equipment_type);
  const answers: ('YES' | 'NO' | 'NA' | undefined)[] = [];
  checklist.sections.forEach((section) =>
    section.items.forEach((item) => answers.push(insp.answers?.[item.id]))
  );

  let ansIdx = 0;
  checklistTable.querySelectorAll('tr').forEach((tr) => {
    if (ansIdx >= answers.length) return;
    const cells = tr.querySelectorAll('td');
    if (cells.length < 6) return; // header / section rows
    if (!(cells[1].textContent || '').trim()) return;

    const answer = answers[ansIdx];
    if (answer === 'YES') setAnswerCell(cells[2], '✓', '#008000');
    else if (answer === 'NO') setAnswerCell(cells[3], '✓', '#cc0000');
    else if (answer === 'NA') setAnswerCell(cells[2], 'N/A', '#6b7280');

    ansIdx++;
  });

  // ── PIC profiles: photo, name, contact QR, phone ──
  const pics = [equipment?.pic_1, equipment?.pic_2];
  container.querySelectorAll('.pic-profiles .profile').forEach((profile, idx) => {
    const pic = pics[idx];
    const nameEl = profile.querySelector('.name');
    const phoneEl = profile.querySelector('.phone');
    const photoEl = profile.querySelector('.photo');
    const qrEl = profile.querySelector('.qr-placeholder');

    if (pic?.name && nameEl) nameEl.textContent = pic.name;
    if (pic?.phone && phoneEl) phoneEl.textContent = pic.phone;

    if (photoEl && pic?.image_profile) {
      (photoEl as HTMLElement).style.background = 'white';
      (photoEl as HTMLElement).style.padding = '0';
      (photoEl as HTMLElement).style.height = 'auto';
      (photoEl as HTMLElement).innerHTML =
        `<img src="${pic.image_profile}" style="width:100%;height:100%;object-fit:cover;display:block;" />`;
    }

    if (qrEl && pic?.image_contact) {
      (qrEl as HTMLElement).style.background = 'none';
      (qrEl as HTMLElement).innerHTML =
        `<img src="${pic.image_contact}" style="width:100%;height:100%;object-fit:contain;display:block;" />`;
    }
  });

  // ── Remarks & Action Taken boxes ──
  const remarkTitle = container.querySelector('.keterangan-box .box-title');
  if (remarkTitle) {
    const text = insp.remarks?.trim() ? insp.remarks : '-';
    (remarkTitle as HTMLElement).innerHTML +=
      `<div style="font-weight:normal;font-size:9px;color:#000;padding-top:2px;white-space:pre-wrap;">${escapeHtml(text)}</div>`;
  }

  const actionTitle = container.querySelector('.tindakan-box .box-title');
  if (actionTitle) {
    const text = insp.action_taken?.trim() ? insp.action_taken : '-';
    (actionTitle as HTMLElement).innerHTML +=
      `<div style="font-weight:normal;font-size:9px;color:#000;padding-top:2px;white-space:pre-wrap;">${escapeHtml(text)}</div>`;
  }

  // ── Inspector (checker) name & digital signature ──
  // Render the signature centered, overlapping the front of the printed name
  // (negative bottom margin + higher z-index) so it reads like a hand-signed box.
  const sig = signatures[insp.inspector_name] || null;
  const checkerBoxes = container.querySelectorAll('.checker-box');
  const checkerContent = checkerBoxes[0]?.querySelector('.box-content');
  if (checkerContent) {
    const sigImg = sig
      ? `<img src="${sig}" style="max-height:46px;width:auto;max-width:100%;object-fit:contain;display:block;margin:0 auto -6px;position:relative;z-index:1;" />`
      : '';
    (checkerContent as HTMLElement).innerHTML =
      `<div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
        ${sigImg}
        <span style="position:relative;text-align:center;font-size:9px;font-weight:bold;line-height:1.25;">${escapeHtml(insp.inspector_name)}</span>
       </div>`;
  }
}

const PRINT_STYLES = `
<style>
  @media print {
    @page { size: A4 portrait; margin: 0; }
    body { margin: 0; padding: 0; display: block !important; background: white !important; }
    .a4-container { box-shadow: none !important; margin: 0 auto !important; padding: 10mm !important; }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
</style>
</head>`;

const PRINT_FOOTER = `
<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 500);
  });
</script>
</body></html>`;

async function loadTemplateHtml(type: string): Promise<string> {
  const res = await fetch(getFormTemplate(type));
  if (!res.ok) throw new Error(`Failed to load checklist template for ${type}`);
  return res.text();
}

/**
 * Builds the full printable HTML document for a list of inspection records,
 * one A4 page per record, using the untouched templates from
 * `/public/form_checklist/`.
 */
export async function buildInspectionPrintPages(
  inspections: PrintInspectionRecord[],
  signatures: Record<string, string | null>
): Promise<{ html: string; header: string }> {
  let finalHtml = '';
  let header = '';

  for (let i = 0; i < inspections.length; i++) {
    const insp = inspections[i];
    const raw = await loadTemplateHtml(insp.equipment_type);

    if (i === 0) {
      const bodyMatch = raw.match(/([\s\S]*?<body[^>]*>)/);
      if (bodyMatch) header = bodyMatch[1];
    }

    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const container = doc.querySelector('.a4-container');
    if (!container) continue;

    fillInspectionPage(container, insp, signatures);

    const page = i < inspections.length - 1
      ? `<div style="page-break-after: always; break-after: page;">${container.outerHTML}</div>`
      : `<div>${container.outerHTML}</div>`;

    finalHtml += page;
  }

  header = absolutizePaths(header.replace('</head>', PRINT_STYLES));
  finalHtml = absolutizePaths(finalHtml);

  return { html: finalHtml, header };
}

/**
 * Opens a new window and triggers the print dialog for the given inspection
 * records rendered through the A4 form checklist templates.
 */
export async function printInspectionResults(
  inspections: PrintInspectionRecord[],
  signatures: Record<string, string | null>
): Promise<void> {
  if (inspections.length === 0) return;

  const { html, header } = await buildInspectionPrintPages(inspections, signatures);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }

  printWindow.document.write(header + html + PRINT_FOOTER);
  printWindow.document.close();
}
