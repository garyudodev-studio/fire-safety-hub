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
  improvement?: {
    status?: string;
    action_plan?: string | null;
    action_taken?: string | null;
    pic_name?: string | null;
    target_date?: string | null;
    completion_date?: string | null;
    after_photo_url?: string | null;
  } | null;
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

export function resolveMonthFormPair(
  target: PrintInspectionRecord,
  allRecords: PrintInspectionRecord[]
): { rightInsp: PrintInspectionRecord; leftInsp: PrintInspectionRecord | null } {
  const sameMonthEquip = allRecords
    .filter(
      (r) =>
        r.equipment_id === target.equipment_id &&
        r.month_year === target.month_year
    )
    .sort((a, b) => {
      const wA = parseInt(a.week) || 0;
      const wB = parseInt(b.week) || 0;
      if (wA !== wB) return wA - wB;
      return (a.inspection_date || '').localeCompare(b.inspection_date || '');
    });

  if (sameMonthEquip.length === 0) {
    return { rightInsp: target, leftInsp: null };
  }

  // Right Column = latest inspection for this equipment in this month
  const rightInsp = sameMonthEquip[sameMonthEquip.length - 1];

  // Left Column = previous week inspection for this equipment in this month (if available)
  const leftInsp = sameMonthEquip.length > 1 ? sameMonthEquip[sameMonthEquip.length - 2] : null;

  return { rightInsp, leftInsp };
}

function fillInspectionPage(
  container: Element,
  rightInsp: PrintInspectionRecord,
  leftInsp: PrintInspectionRecord | null | undefined,
  signatures: Record<string, string | null>
) {
  const equipment = rightInsp.equipment || leftInsp?.equipment;
  const monthYear = rightInsp.month_year || leftInsp?.month_year || '';

  // ── Identity info table: ID / AREA / LOCATION / Month-Year / Week ──
  const weekCells: Element[] = [];
  container.querySelectorAll('.info-table td').forEach((cell) => {
    const el = cell as HTMLElement;
    const txt = el.textContent || '';
    const trimmed = txt.trim();

    if (/^(ALARM|APAR|HYDRANT|LIGHT)\s+ID$/.test(trimmed)) {
      const next = el.nextElementSibling;
      if (next) next.textContent = `: ${rightInsp.equipment_no_id}`;
    } else if (trimmed === 'AREA') {
      const next = el.nextElementSibling;
      if (next) next.textContent = `: ${equipment?.area || ''}`;
    } else if (trimmed === 'LOCATION') {
      const next = el.nextElementSibling;
      if (next) next.textContent = `: ${equipment?.location || ''}`;
    } else if (/Month\s*\/\s*Year/.test(txt)) {
      el.innerHTML = appendAfterColon(el.innerHTML, formatMonthYearLabel(monthYear));
    } else if (/Week/.test(txt)) {
      weekCells.push(cell);
    }
  });

  if (weekCells[0]) {
    weekCells[0].innerHTML = appendAfterColon(
      weekCells[0].innerHTML,
      leftInsp?.week ? String(leftInsp.week) : ''
    );
  }
  if (weekCells[1]) {
    weekCells[1].innerHTML = appendAfterColon(
      weekCells[1].innerHTML,
      rightInsp?.week ? String(rightInsp.week) : ''
    );
  }

  const checklistTable = container.querySelector('.checklist-table');
  if (!checklistTable) return;

  // ── Date column in checklist header (Left = previous week, Right = latest) ──
  const dateCells: Element[] = [];
  checklistTable.querySelectorAll('td').forEach((cell) => {
    const el = cell as HTMLElement;
    if (el.getAttribute('colspan') === '2' && /Date/i.test(el.textContent || '')) {
      dateCells.push(cell);
    }
  });

  if (dateCells[0]) {
    dateCells[0].innerHTML = appendAfterColon(
      dateCells[0].innerHTML,
      leftInsp?.inspection_date || ''
    );
  }
  if (dateCells[1]) {
    dateCells[1].innerHTML = appendAfterColon(
      dateCells[1].innerHTML,
      rightInsp?.inspection_date || ''
    );
  }

  // ── Mark checklist answers ──
  // Column 1 (Left): cells[2] for YES/NA, cells[3] for NO
  // Column 2 (Right): cells[4] for YES/NA, cells[5] for NO
  const checklist = getChecklistForType(rightInsp.equipment_type);
  const leftAnswers: ('YES' | 'NO' | 'NA' | undefined)[] = [];
  const rightAnswers: ('YES' | 'NO' | 'NA' | undefined)[] = [];

  checklist.sections.forEach((section) =>
    section.items.forEach((item) => {
      leftAnswers.push(leftInsp?.answers?.[item.id]);
      rightAnswers.push(rightInsp?.answers?.[item.id]);
    })
  );

  let ansIdx = 0;
  checklistTable.querySelectorAll('tr').forEach((tr) => {
    if (ansIdx >= rightAnswers.length) return;
    const cells = tr.querySelectorAll('td');
    if (cells.length < 6) return; // header / section rows
    if (!(cells[1].textContent || '').trim()) return;

    if (leftInsp) {
      const leftAns = leftAnswers[ansIdx];
      if (leftAns === 'YES') setAnswerCell(cells[2], '✓', '#008000');
      else if (leftAns === 'NO') setAnswerCell(cells[3], '✓', '#cc0000');
      else if (leftAns === 'NA') setAnswerCell(cells[2], 'N/A', '#6b7280');
    }

    if (rightInsp) {
      const rightAns = rightAnswers[ansIdx];
      if (rightAns === 'YES') setAnswerCell(cells[4], '✓', '#008000');
      else if (rightAns === 'NO') setAnswerCell(cells[5], '✓', '#cc0000');
      else if (rightAns === 'NA') setAnswerCell(cells[4], 'N/A', '#6b7280');
    }

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
    const parts: string[] = [];
    if (leftInsp?.remarks?.trim()) {
      parts.push(`[W${leftInsp.week}]: ${leftInsp.remarks.trim()}`);
    }
    if (rightInsp?.remarks?.trim()) {
      parts.push(`[W${rightInsp.week}]: ${rightInsp.remarks.trim()}`);
    }
    const text = parts.length > 0 ? parts.join('\n') : '-';
    (remarkTitle as HTMLElement).innerHTML +=
      `<div style="font-weight:normal;font-size:9px;color:#000;padding-top:2px;white-space:pre-wrap;">${escapeHtml(text)}</div>`;
  }

  const actionTitle = container.querySelector('.tindakan-box .box-title');
  if (actionTitle) {
    const parts: string[] = [];
    if (leftInsp?.action_taken?.trim()) {
      parts.push(`[W${leftInsp.week}]: ${leftInsp.action_taken.trim()}`);
    }
    if (rightInsp?.action_taken?.trim()) {
      parts.push(`[W${rightInsp.week}]: ${rightInsp.action_taken.trim()}`);
    }
    const text = parts.length > 0 ? parts.join('\n') : '-';
    (actionTitle as HTMLElement).innerHTML +=
      `<div style="font-weight:normal;font-size:9px;color:#000;padding-top:2px;white-space:pre-wrap;">${escapeHtml(text)}</div>`;
  }

  // ── Inspector (checker) names & digital signatures ──
  const checkerBoxes = container.querySelectorAll('.checker-box');

  // Left Checker Box (checkerBoxes[0])
  if (checkerBoxes[0] && leftInsp) {
    const contentEl = checkerBoxes[0].querySelector('.box-content');
    if (contentEl) {
      const sig = signatures[leftInsp.inspector_name] || null;
      const sigImg = sig
        ? `<img src="${sig}" style="max-height:46px;width:auto;max-width:100%;object-fit:contain;display:block;margin:0 auto -6px;position:relative;z-index:1;" />`
        : '';
      (contentEl as HTMLElement).innerHTML =
        `<div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
          ${sigImg}
          <span style="position:relative;text-align:center;font-size:9px;font-weight:bold;line-height:1.25;">${escapeHtml(leftInsp.inspector_name)}</span>
         </div>`;
    }
  }

  // Right Checker Box (checkerBoxes[1])
  if (checkerBoxes[1] && rightInsp) {
    const contentEl = checkerBoxes[1].querySelector('.box-content');
    if (contentEl) {
      const sig = signatures[rightInsp.inspector_name] || null;
      const sigImg = sig
        ? `<img src="${sig}" style="max-height:46px;width:auto;max-width:100%;object-fit:contain;display:block;margin:0 auto -6px;position:relative;z-index:1;" />`
        : '';
      (contentEl as HTMLElement).innerHTML =
        `<div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
          ${sigImg}
          <span style="position:relative;text-align:center;font-size:9px;font-weight:bold;line-height:1.25;">${escapeHtml(rightInsp.inspector_name)}</span>
         </div>`;
    }
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
  signatures: Record<string, string | null>,
  allInspections?: PrintInspectionRecord[]
): Promise<{ html: string; header: string }> {
  let finalHtml = '';
  let header = '';

  const pool = allInspections || inspections;

  // Group target inspections by equipment_id + month_year so each equipment generates 1 combined monthly checklist page
  const targetGroups = new Map<string, PrintInspectionRecord>();
  inspections.forEach((insp) => {
    const key = `${insp.equipment_id}_${insp.month_year}`;
    if (!targetGroups.has(key)) {
      targetGroups.set(key, insp);
    }
  });

  const uniquePairs = Array.from(targetGroups.values()).map((targetInsp) =>
    resolveMonthFormPair(targetInsp, pool)
  );

  for (let i = 0; i < uniquePairs.length; i++) {
    const { rightInsp, leftInsp } = uniquePairs[i];

    const raw = await loadTemplateHtml(rightInsp.equipment_type);

    if (i === 0) {
      const bodyMatch = raw.match(/([\s\S]*?<body[^>]*>)/);
      if (bodyMatch) header = bodyMatch[1];
    }

    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const container = doc.querySelector('.a4-container');
    if (!container) continue;

    fillInspectionPage(container, rightInsp, leftInsp, signatures);

    const page = i < uniquePairs.length - 1
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
  signatures: Record<string, string | null>,
  allInspections?: PrintInspectionRecord[]
): Promise<void> {
  if (inspections.length === 0) return;

  const { html, header } = await buildInspectionPrintPages(inspections, signatures, allInspections);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }

  printWindow.document.write(header + html + PRINT_FOOTER);
  printWindow.document.close();
}

